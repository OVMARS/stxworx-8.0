import { type Request, type Response } from "express";
import { z } from "zod";
import { socialService } from "../services/social.service";

const createPostSchema = z.object({
  content: z.string().min(1).max(4000),
  imageUrl: z.string().url().optional().or(z.literal("")),
});

export const socialController = {
  async listByAddress(req: Request, res: Response) {
    try {
      const userId = await socialService.getUserIdByAddress(req.params.address);
      if (!userId) {
        return res.status(404).json({ message: "User not found" });
      }

      const posts = await socialService.getByUserId(userId, req.user?.id);
      return res.status(200).json(posts);
    } catch (error) {
      console.error("List posts error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const result = createPostSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Validation error", errors: result.error.errors });
      }

      const created = await socialService.create(req.user!.id, result.data.content, result.data.imageUrl || undefined);
      return res.status(201).json(created);
    } catch (error) {
      console.error("Create post error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async toggleLike(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      const result = await socialService.toggleLike(id, req.user!.id);
      return res.status(200).json(result);
    } catch (error) {
      console.error("Toggle like error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
};
