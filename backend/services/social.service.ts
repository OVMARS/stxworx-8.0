import { db } from "../db";
import { postComments, postLikes, postViews, socialPosts, users } from "@shared/schema";
import { and, asc, desc, eq, gte, isNotNull, or, sql } from "drizzle-orm";

type SocialPostRecord = {
  id: number;
  userId: number;
  content: string;
  imageUrl: string | null;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
  authorStxAddress: string | null;
  authorName: string | null;
  authorUsername: string | null;
  authorAvatar: string | null;
};

type SocialPostSort = "recent" | "oldest" | "likes" | "views";
type SocialPostRange = "all" | "week" | "month" | "year";

type SocialPostListFilters = {
  query?: string;
  tag?: string;
  sort?: SocialPostSort;
  range?: SocialPostRange;
  limit?: number;
};

const socialPostSelection = {
  id: socialPosts.id,
  userId: socialPosts.userId,
  content: socialPosts.content,
  imageUrl: socialPosts.imageUrl,
  isPinned: socialPosts.isPinned,
  createdAt: socialPosts.createdAt,
  updatedAt: socialPosts.updatedAt,
  authorStxAddress: users.stxAddress,
  authorName: users.name,
  authorUsername: users.username,
  authorAvatar: users.avatar,
};

type SocialCommentRecord = {
  id: number;
  postId: number;
  userId: number;
  content: string;
  createdAt: Date;
  authorStxAddress: string | null;
  authorName: string | null;
  authorUsername: string | null;
  authorAvatar: string | null;
};

function normalizeSearchValue(value?: string) {
  return value?.trim().toLowerCase() || "";
}

function normalizeHashtag(value?: string) {
  return value?.trim().replace(/^#/, "").toLowerCase() || "";
}

function extractHashtags(content: string) {
  return Array.from(content.matchAll(/#([a-z0-9_]+)/gi), (match) => match[1].toLowerCase());
}

function getRangeStart(range?: SocialPostRange) {
  const now = new Date();

  if (range === "week") {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  if (range === "month") {
    const next = new Date(now);
    next.setMonth(now.getMonth() - 1);
    return next;
  }

  if (range === "year") {
    const next = new Date(now);
    next.setFullYear(now.getFullYear() - 1);
    return next;
  }

  return null;
}

function isMissingPostViewsTableError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("post_views") && (message.includes("doesn't exist") || message.includes("no such table"));
}

function sortPosts<T extends { createdAt: Date; likesCount: number; viewsCount: number }>(posts: T[], sort: SocialPostSort) {
  const next = [...posts];

  next.sort((left, right) => {
    if (sort === "oldest") {
      return left.createdAt.getTime() - right.createdAt.getTime();
    }

    if (sort === "likes") {
      if (right.likesCount !== left.likesCount) {
        return right.likesCount - left.likesCount;
      }

      if (right.viewsCount !== left.viewsCount) {
        return right.viewsCount - left.viewsCount;
      }

      return right.createdAt.getTime() - left.createdAt.getTime();
    }

    if (sort === "views") {
      if (right.viewsCount !== left.viewsCount) {
        return right.viewsCount - left.viewsCount;
      }

      if (right.likesCount !== left.likesCount) {
        return right.likesCount - left.likesCount;
      }

      return right.createdAt.getTime() - left.createdAt.getTime();
    }

    return right.createdAt.getTime() - left.createdAt.getTime();
  });

  return next;
}

async function getPostRecord(postId: number): Promise<SocialPostRecord | null> {
  const [post] = await db
    .select(socialPostSelection)
    .from(socialPosts)
    .leftJoin(users, eq(socialPosts.userId, users.id))
    .where(eq(socialPosts.id, postId));

  return post ?? null;
}

async function postExists(postId: number) {
  const [post] = await db
    .select({ id: socialPosts.id })
    .from(socialPosts)
    .where(eq(socialPosts.id, postId));

  return Boolean(post);
}

async function recordView(postId: number, viewerId?: number, visitorKey?: string | null) {
  try {
    await db.insert(postViews).values({
      postId,
      userId: viewerId ?? null,
      visitorKey: visitorKey || null,
    });
  } catch (error) {
    if (!isMissingPostViewsTableError(error)) {
      throw error;
    }
  }
}

async function listPostViews(postId: number) {
  try {
    return await db.select({ id: postViews.id }).from(postViews).where(eq(postViews.postId, postId));
  } catch (error) {
    if (isMissingPostViewsTableError(error)) {
      return [];
    }

    throw error;
  }
}

async function enrichPosts(posts: SocialPostRecord[], viewerId?: number) {
  return Promise.all(
    posts.map(async (post) => {
      const [likes, comments, views, viewerLike] = await Promise.all([
        db.select({ id: postLikes.id, userId: postLikes.userId }).from(postLikes).where(eq(postLikes.postId, post.id)),
        db.select({ id: postComments.id }).from(postComments).where(eq(postComments.postId, post.id)),
        listPostViews(post.id),
        viewerId
          ? db.select({ id: postLikes.id }).from(postLikes).where(and(eq(postLikes.postId, post.id), eq(postLikes.userId, viewerId)))
          : Promise.resolve([]),
      ]);
      const likedByViewer = viewerId ? viewerLike.length > 0 : false;

      return {
        ...post,
        likesCount: likes.length,
        commentsCount: comments.length,
        viewsCount: views.length,
        likedByViewer,
      };
    }),
  );
}

export const socialService = {
  async getFeed(viewerId?: number, limit = 12) {
    const posts = await db
      .select(socialPostSelection)
      .from(socialPosts)
      .leftJoin(users, eq(socialPosts.userId, users.id))
      .orderBy(desc(socialPosts.createdAt))
      .limit(limit);

    return enrichPosts(posts, viewerId);
  },

  async listPosts(viewerId: number | undefined, filters: SocialPostListFilters = {}) {
    const normalizedQuery = normalizeSearchValue(filters.query);
    const normalizedTag = normalizeHashtag(filters.tag || (normalizedQuery.startsWith("#") ? normalizedQuery : ""));
    const rangeStart = getRangeStart(filters.range);
    const clauses = [];

    if (rangeStart) {
      clauses.push(gte(socialPosts.createdAt, rangeStart));
    }

    if (normalizedQuery && !normalizedQuery.startsWith("#")) {
      clauses.push(
        or(
          sql`lower(${socialPosts.content}) like ${`%${normalizedQuery}%`}`,
          sql`lower(coalesce(${users.username}, '')) like ${`%${normalizedQuery}%`}`,
          sql`lower(coalesce(${users.name}, '')) like ${`%${normalizedQuery}%`}`
        )
      );
    }

    const whereClause = clauses.length === 0 ? undefined : clauses.length === 1 ? clauses[0] : and(...clauses);
    const posts = await db
      .select(socialPostSelection)
      .from(socialPosts)
      .leftJoin(users, eq(socialPosts.userId, users.id))
      .where(whereClause)
      .orderBy(desc(socialPosts.createdAt));

    const filteredPosts = normalizedTag
      ? posts.filter((post) => extractHashtags(post.content).includes(normalizedTag))
      : posts;

    const enriched = await enrichPosts(filteredPosts, viewerId);
    const sorted = sortPosts(enriched, filters.sort || "recent");
    return sorted.slice(0, filters.limit ?? 100);
  },

  async getById(postId: number, viewerId?: number, options?: { recordView?: boolean; visitorKey?: string | null }) {
    const post = await getPostRecord(postId);
    if (!post) {
      return null;
    }

    if (options?.recordView) {
      await recordView(postId, viewerId, options.visitorKey);
    }

    const [enriched] = await enrichPosts([post], viewerId);
    return enriched ?? null;
  },

  async getByUserId(userId: number, viewerId?: number) {
    const posts = await db
      .select(socialPostSelection)
      .from(socialPosts)
      .leftJoin(users, eq(socialPosts.userId, users.id))
      .where(eq(socialPosts.userId, userId))
      .orderBy(desc(socialPosts.isPinned), desc(socialPosts.createdAt));

    return enrichPosts(posts, viewerId);
  },

  async create(userId: number, content: string, imageUrl?: string) {
    const [result] = await db.insert(socialPosts).values({
      userId,
      content,
      imageUrl: imageUrl ?? null,
    });

    const [created] = await db
      .select(socialPostSelection)
      .from(socialPosts)
      .leftJoin(users, eq(socialPosts.userId, users.id))
      .where(eq(socialPosts.id, result.insertId));

    if (!created) {
      return null;
    }

    const [enriched] = await enrichPosts([created], userId);
    return enriched || null;
  },

  async update(postId: number, userId: number, content: string) {
    const post = await getPostRecord(postId);
    if (!post) {
      return null;
    }

    if (post.userId !== userId) {
      return false;
    }

    const trimmedContent = content.trim();
    if (!trimmedContent && !post.imageUrl) {
      throw new Error("Post content or image is required");
    }

    await db
      .update(socialPosts)
      .set({
        content: trimmedContent,
        updatedAt: new Date(),
      })
      .where(eq(socialPosts.id, postId));

    return this.getById(postId, userId);
  },

  async remove(postId: number, userId: number) {
    const post = await getPostRecord(postId);
    if (!post) {
      return null;
    }

    if (post.userId !== userId) {
      return false;
    }

    await db.delete(postLikes).where(eq(postLikes.postId, postId));
    await db.delete(postComments).where(eq(postComments.postId, postId));
    try {
      await db.delete(postViews).where(eq(postViews.postId, postId));
    } catch (error) {
      if (!isMissingPostViewsTableError(error)) {
        throw error;
      }
    }
    await db.delete(socialPosts).where(eq(socialPosts.id, postId));

    return true;
  },

  async togglePin(postId: number, userId: number) {
    const post = await getPostRecord(postId);
    if (!post) {
      return null;
    }

    if (post.userId !== userId) {
      return false;
    }

    const nextPinned = !post.isPinned;

    if (nextPinned) {
      await db
        .update(socialPosts)
        .set({
          isPinned: false,
          updatedAt: new Date(),
        })
        .where(eq(socialPosts.userId, userId));
    }

    await db
      .update(socialPosts)
      .set({
        isPinned: nextPinned,
        updatedAt: new Date(),
      })
      .where(eq(socialPosts.id, postId));

    return this.getById(postId, userId);
  },

  async toggleLike(postId: number, userId: number) {
    if (!(await postExists(postId))) {
      return null;
    }

    const [existing] = await db
      .select()
      .from(postLikes)
      .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)));

    if (existing) {
      await db.delete(postLikes).where(eq(postLikes.id, existing.id));
    } else {
      await db.insert(postLikes).values({ postId, userId });
    }

    const likes = await db.select().from(postLikes).where(eq(postLikes.postId, postId));
    return {
      likesCount: likes.length,
      likedByViewer: !existing,
    };
  },

  async listComments(postId: number) {
    if (!(await postExists(postId))) {
      return null;
    }

    const comments = await db
      .select({
        id: postComments.id,
        postId: postComments.postId,
        userId: postComments.userId,
        content: postComments.content,
        createdAt: postComments.createdAt,
        authorStxAddress: users.stxAddress,
        authorName: users.name,
        authorUsername: users.username,
        authorAvatar: users.avatar,
      })
      .from(postComments)
      .leftJoin(users, eq(postComments.userId, users.id))
      .where(eq(postComments.postId, postId))
      .orderBy(desc(postComments.createdAt));

    return comments satisfies SocialCommentRecord[];
  },

  async createComment(postId: number, userId: number, content: string) {
    if (!(await postExists(postId))) {
      return null;
    }

    const [result] = await db.insert(postComments).values({
      postId,
      userId,
      content,
    });

    const [comment] = await db
      .select({
        id: postComments.id,
        postId: postComments.postId,
        userId: postComments.userId,
        content: postComments.content,
        createdAt: postComments.createdAt,
        authorStxAddress: users.stxAddress,
        authorName: users.name,
        authorUsername: users.username,
        authorAvatar: users.avatar,
      })
      .from(postComments)
      .leftJoin(users, eq(postComments.userId, users.id))
      .where(eq(postComments.id, result.insertId));

    return comment ?? null;
  },

  async getUserIdByAddress(address: string) {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.stxAddress, address));

    return user?.id ?? null;
  },
};
