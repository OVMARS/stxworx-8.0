import { db } from "../db";
import { notifications } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export const notificationService = {
  async create(data: {
    userId: number;
    type: typeof notifications.$inferInsert["type"];
    title: string;
    message: string;
    projectId?: number;
  }) {
    const [result] = await db.insert(notifications).values({
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      projectId: data.projectId ?? null,
    });
    const [notification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, result.insertId));
    return notification;
  },

  async getByUser(userId: number, limit = 50) {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  },

  async getUnreadCount(userId: number): Promise<number> {
    const rows = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return rows.length;
  },

  async markAsRead(id: number, userId: number) {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
  },

  async markAllAsRead(userId: number) {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  },

  async deleteAllForUser(userId: number) {
    await db
      .delete(notifications)
      .where(eq(notifications.userId, userId));
  },
};
