import { db } from "../db";
import { userSettings } from "@shared/schema";
import { eq } from "drizzle-orm";

export const settingsService = {
  async getByUser(userId: number) {
    const [existing] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));

    if (existing) {
      return existing;
    }

    await db.insert(userSettings).values({ userId });
    const [created] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    return created!;
  },

  async update(userId: number, data: {
    notificationsEnabled?: boolean;
    emailNotifications?: boolean;
    messagingOption?: "everyone" | "clients_only" | "connections_only";
    profileVisibility?: "public" | "private";
    email?: string | null;
    twitterHandle?: string | null;
    isTwitterConnected?: boolean;
  }) {
    await this.getByUser(userId);

    await db
      .update(userSettings)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(userSettings.userId, userId));

    const [updated] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    return updated!;
  },
};
