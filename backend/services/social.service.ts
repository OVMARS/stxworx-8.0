import { db } from "../db";
import { postLikes, socialPosts, users } from "@shared/schema";
import { desc, eq, and } from "drizzle-orm";

export const socialService = {
  async getByUserId(userId: number, viewerId?: number) {
    const posts = await db
      .select()
      .from(socialPosts)
      .where(eq(socialPosts.userId, userId))
      .orderBy(desc(socialPosts.createdAt));

    return Promise.all(
      posts.map(async (post) => {
        const likes = await db.select().from(postLikes).where(eq(postLikes.postId, post.id));
        const likedByViewer = viewerId ? likes.some((like) => like.userId === viewerId) : false;

        return {
          ...post,
          likesCount: likes.length,
          commentsCount: 0,
          likedByViewer,
        };
      }),
    );
  },

  async create(userId: number, content: string, imageUrl?: string) {
    const [result] = await db.insert(socialPosts).values({
      userId,
      content,
      imageUrl: imageUrl ?? null,
    });

    const [created] = await db.select().from(socialPosts).where(eq(socialPosts.id, result.insertId));
    return created || null;
  },

  async toggleLike(postId: number, userId: number) {
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

  async getUserIdByAddress(address: string) {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.stxAddress, address));

    return user?.id ?? null;
  },
};
