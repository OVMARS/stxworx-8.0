import { db } from "../db";
import { reputationNfts, users } from "@shared/schema";
import { desc, eq } from "drizzle-orm";

export const nftService = {
  async getByUserId(userId: number) {
    return db
      .select()
      .from(reputationNfts)
      .where(eq(reputationNfts.recipientId, userId))
      .orderBy(desc(reputationNfts.createdAt));
  },

  async getByAddress(address: string) {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.stxAddress, address));

    if (!user) {
      return null;
    }

    return this.getByUserId(user.id);
  },
};
