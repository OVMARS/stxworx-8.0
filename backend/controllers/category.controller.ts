import { type Request, type Response } from "express";
import { db } from "../db";
import { categories } from "@shared/schema";

export const categoryController = {
  // GET /api/categories
  async getAll(_req: Request, res: Response) {
    try {
      const allCategories = await db.select().from(categories);
      return res.status(200).json(allCategories);
    } catch (error) {
      console.error("Get categories error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
};
