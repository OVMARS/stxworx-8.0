import { db } from "../db";
import { platformSettings } from "@shared/schema";
import { eq } from "drizzle-orm";

export const platformSettingsService = {
  async get() {
    const [existing] = await db.select().from(platformSettings).where(eq(platformSettings.id, 1));
    if (existing) {
      return existing;
    }

    await db.insert(platformSettings).values({ id: 1 });
    const [created] = await db.select().from(platformSettings).where(eq(platformSettings.id, 1));
    return created!;
  },

  async update(data: { daoFeePercentage?: string; daoWalletAddress?: string | null }) {
    await this.get();

    await db
      .update(platformSettings)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(platformSettings.id, 1));

    const [updated] = await db.select().from(platformSettings).where(eq(platformSettings.id, 1));
    return updated!;
  },
};
