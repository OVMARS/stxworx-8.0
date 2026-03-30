import { db } from "../db";
import { conversationParticipants, conversations, messages, userSettings, users } from "@shared/schema";
import { and, asc, desc, eq, gt, ne, inArray } from "drizzle-orm";
import { connectionsService } from "./connections.service";
import { saveChatAttachment, type ChatAttachmentUpload } from "./message-attachment.service";

async function getUser(userId: number) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  return user || null;
}

async function getUnreadMessagesForParticipant(conversationId: number, userId: number, lastReadAt?: Date | null) {
  const unreadMessages = lastReadAt
    ? await db
        .select({ id: messages.id })
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conversationId),
            eq(messages.isDeleted, false),
            ne(messages.senderId, userId),
            gt(messages.createdAt, lastReadAt),
          ),
        )
    : await db
        .select({ id: messages.id })
        .from(messages)
        .where(and(eq(messages.conversationId, conversationId), eq(messages.isDeleted, false), ne(messages.senderId, userId)));

  return unreadMessages.length;
}

type SendMessageInput = {
  body?: string;
  attachment?: ChatAttachmentUpload;
};

const messageSelectFields = {
  id: messages.id,
  conversationId: messages.conversationId,
  senderId: messages.senderId,
  body: messages.body,
  attachmentUrl: messages.attachmentUrl,
  attachmentName: messages.attachmentName,
  attachmentMimeType: messages.attachmentMimeType,
  attachmentSize: messages.attachmentSize,
  isPinned: messages.isPinned,
  isEdited: messages.isEdited,
  isDeleted: messages.isDeleted,
  updatedAt: messages.updatedAt,
  deletedAt: messages.deletedAt,
  createdAt: messages.createdAt,
  senderAddress: users.stxAddress,
  senderName: users.name,
  senderUsername: users.username,
  senderRole: users.role,
};

function toMessagePreview(message?: {
  body?: string | null;
  attachmentName?: string | null;
  attachmentMimeType?: string | null;
  isDeleted?: boolean | null;
}) {
  if (message?.isDeleted) {
    return "Message deleted";
  }

  const body = message?.body?.trim();
  if (body) {
    return body;
  }

  const attachmentName = message?.attachmentName?.trim();
  if (!attachmentName) {
    return "";
  }

  return message?.attachmentMimeType?.startsWith("image/")
    ? `Image: ${attachmentName}`
    : `Attachment: ${attachmentName}`;
}

async function fetchMessageById(messageId: number) {
  const [message] = await db
    .select(messageSelectFields)
    .from(messages)
    .leftJoin(users, eq(messages.senderId, users.id))
    .where(eq(messages.id, messageId));

  return message || null;
}

export const messagesService = {
  async assertConversationAccess(conversationId: number, userId: number) {
    const [participant] = await db
      .select()
      .from(conversationParticipants)
      .where(and(eq(conversationParticipants.conversationId, conversationId), eq(conversationParticipants.userId, userId)));

    if (!participant) {
      throw new Error("Conversation not found");
    }

    return participant;
  },

  async getMessageForConversation(conversationId: number, messageId: number, userId: number) {
    await this.assertConversationAccess(conversationId, userId);

    const [message] = await db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        senderId: messages.senderId,
        body: messages.body,
        attachmentUrl: messages.attachmentUrl,
        isDeleted: messages.isDeleted,
      })
      .from(messages)
      .where(and(eq(messages.id, messageId), eq(messages.conversationId, conversationId)));

    if (!message) {
      throw new Error("Message not found");
    }

    return message;
  },

  async touchConversation(conversationId: number) {
    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));
  },

  async assertCanMessage(senderId: number, recipientId: number) {
    const sender = await getUser(senderId);
    const recipient = await getUser(recipientId);

    if (!sender || !recipient || !recipient.isActive) {
      throw new Error("Recipient not available");
    }

    const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, recipientId));
    const messagingOption = settings?.messagingOption ?? "everyone";

    if (messagingOption === "clients_only" && sender.role !== "client") {
      throw new Error("This user only accepts messages from clients");
    }

    if (messagingOption === "connections_only" && !(await connectionsService.areConnected(senderId, recipientId))) {
      throw new Error("This user only accepts messages from connections");
    }
  },

  async getOrCreateDirectConversation(userId: number, otherUserId: number) {
    const mine = await db
      .select({ conversationId: conversationParticipants.conversationId })
      .from(conversationParticipants)
      .where(eq(conversationParticipants.userId, userId));

    if (mine.length === 0) {
      return this.createNewConversation(userId, otherUserId);
    }

    const conversationIds = mine.map(row => row.conversationId);
    
    const participants = await db
      .select()
      .from(conversationParticipants)
      .where(inArray(conversationParticipants.conversationId, conversationIds));

    const conversationParticipantsMap = new Map<number, number[]>();
    participants.forEach(p => {
      if (!conversationParticipantsMap.has(p.conversationId)) {
        conversationParticipantsMap.set(p.conversationId, []);
      }
      conversationParticipantsMap.get(p.conversationId)!.push(p.userId);
    });

    for (const conversationId of conversationParticipantsMap.keys()) {
      const participantIds = conversationParticipantsMap.get(conversationId)!;
      if (participantIds.length === 2 && participantIds.includes(otherUserId)) {
        const [existing] = await db.select().from(conversations).where(eq(conversations.id, conversationId));
        return existing || null;
      }
    }

    return this.createNewConversation(userId, otherUserId);
  },

  async createNewConversation(userId: number, otherUserId: number) {
    const [result] = await db.insert(conversations).values({});
    await db.insert(conversationParticipants).values([
      { conversationId: result.insertId, userId, lastReadAt: new Date() },
      { conversationId: result.insertId, userId: otherUserId },
    ]);
    const [created] = await db.select().from(conversations).where(eq(conversations.id, result.insertId));
    return created || null;
  },

  async getUnreadCount(userId: number) {
    const memberships = await db
      .select()
      .from(conversationParticipants)
      .where(eq(conversationParticipants.userId, userId));

    const unreadCounts = await Promise.all(
      memberships.map((membership) =>
        getUnreadMessagesForParticipant(membership.conversationId, userId, membership.lastReadAt),
      ),
    );

    return unreadCounts.reduce((total, count) => total + count, 0);
  },

  async listForUser(userId: number) {
    const memberships = await db
      .select()
      .from(conversationParticipants)
      .where(eq(conversationParticipants.userId, userId));

    const conversationsWithMeta = await Promise.all(
      memberships.map(async (membership) => {
        const [otherParticipant] = await db
          .select()
          .from(conversationParticipants)
          .where(
            and(
              eq(conversationParticipants.conversationId, membership.conversationId),
              ne(conversationParticipants.userId, userId),
            ),
          );

        if (!otherParticipant) {
          return null;
        }

        const [participantUser] = await db
          .select({
            id: users.id,
            stxAddress: users.stxAddress,
            name: users.name,
            username: users.username,
            role: users.role,
            avatar: users.avatar,
          })
          .from(users)
          .where(eq(users.id, otherParticipant.userId));

        const [lastMessage] = await db
          .select({
            body: messages.body,
            attachmentName: messages.attachmentName,
            attachmentMimeType: messages.attachmentMimeType,
            isDeleted: messages.isDeleted,
            createdAt: messages.createdAt,
          })
          .from(messages)
          .where(eq(messages.conversationId, membership.conversationId))
          .orderBy(desc(messages.createdAt));

        const unreadCount = await getUnreadMessagesForParticipant(
          membership.conversationId,
          userId,
          membership.lastReadAt,
        );

        return {
          id: membership.conversationId,
          participant: participantUser,
          lastMessage: toMessagePreview(lastMessage),
          lastMessageAt: lastMessage?.createdAt ?? membership.createdAt,
          unreadCount,
        };
      }),
    );

    return conversationsWithMeta
      .filter(Boolean)
      .sort((left, right) => new Date(right!.lastMessageAt).getTime() - new Date(left!.lastMessageAt).getTime());
  },

  async getMessages(conversationId: number, userId: number) {
    await this.assertConversationAccess(conversationId, userId);

    const rows = await db
      .select(messageSelectFields)
      .from(messages)
      .leftJoin(users, eq(messages.senderId, users.id))
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt));

    await db
      .update(conversationParticipants)
      .set({ lastReadAt: new Date() })
      .where(and(eq(conversationParticipants.conversationId, conversationId), eq(conversationParticipants.userId, userId)));

    return rows;
  },

  async startConversation(userId: number, otherUserId: number, initialMessage?: string) {
    await this.assertCanMessage(userId, otherUserId);
    const conversation = await this.getOrCreateDirectConversation(userId, otherUserId);

    if (initialMessage?.trim() && conversation) {
      await this.sendMessage(conversation.id, userId, { body: initialMessage });
    }

    return conversation;
  },

  async sendMessage(conversationId: number, userId: number, input: SendMessageInput) {
    await this.assertConversationAccess(conversationId, userId);

    const body = input.body?.trim() ?? "";
    const savedAttachment = input.attachment ? await saveChatAttachment(input.attachment) : null;

    const [result] = await db.insert(messages).values({
      conversationId,
      senderId: userId,
      body,
      attachmentUrl: savedAttachment?.url,
      attachmentName: savedAttachment?.fileName,
      attachmentMimeType: savedAttachment?.mimeType,
      attachmentSize: savedAttachment?.size,
      updatedAt: new Date(),
    });

    await this.touchConversation(conversationId);

    await db
      .update(conversationParticipants)
      .set({ lastReadAt: new Date() })
      .where(and(eq(conversationParticipants.conversationId, conversationId), eq(conversationParticipants.userId, userId)));

    return fetchMessageById(result.insertId);
  },

  async updateMessage(conversationId: number, messageId: number, userId: number, body: string) {
    const existing = await this.getMessageForConversation(conversationId, messageId, userId);

    if (existing.senderId !== userId) {
      throw new Error("You can only edit your own messages");
    }

    if (existing.isDeleted) {
      throw new Error("Deleted messages cannot be edited");
    }

    const nextBody = body.trim();
    if (!nextBody && !existing.attachmentUrl) {
      throw new Error("Message body is required");
    }

    await db
      .update(messages)
      .set({
        body: nextBody,
        isEdited: true,
        updatedAt: new Date(),
      })
      .where(eq(messages.id, messageId));

    await this.touchConversation(conversationId);

    return fetchMessageById(messageId);
  },

  async deleteMessage(conversationId: number, messageId: number, userId: number) {
    const existing = await this.getMessageForConversation(conversationId, messageId, userId);

    if (existing.senderId !== userId) {
      throw new Error("You can only delete your own messages");
    }

    if (existing.isDeleted) {
      return fetchMessageById(messageId);
    }

    await db
      .update(messages)
      .set({
        body: "",
        attachmentUrl: null,
        attachmentName: null,
        attachmentMimeType: null,
        attachmentSize: null,
        isPinned: false,
        isDeleted: true,
        updatedAt: new Date(),
        deletedAt: new Date(),
      })
      .where(eq(messages.id, messageId));

    await this.touchConversation(conversationId);

    return fetchMessageById(messageId);
  },

  async setPinned(conversationId: number, messageId: number, userId: number, isPinned: boolean) {
    const existing = await this.getMessageForConversation(conversationId, messageId, userId);

    if (existing.isDeleted) {
      throw new Error("Deleted messages cannot be pinned");
    }

    await db
      .update(messages)
      .set({
        isPinned,
        updatedAt: new Date(),
      })
      .where(eq(messages.id, messageId));

    await this.touchConversation(conversationId);

    return fetchMessageById(messageId);
  },
};
