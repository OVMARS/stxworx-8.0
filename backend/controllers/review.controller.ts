import { type Request, type Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { reviews } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { projectService } from "../services/project.service";

const createReviewSchema = z.object({
  projectId: z.number().int(),
  revieweeId: z.number().int(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

export const reviewController = {
  // POST /api/reviews
  async create(req: Request, res: Response) {
    try {
      const result = createReviewSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Validation error", errors: result.error.errors });
      }

      const { projectId, revieweeId, rating, comment } = result.data;

      // Verify project is completed
      const project = await projectService.getById(projectId);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (project.status !== "completed") {
        return res.status(400).json({ message: "Can only review completed projects" });
      }

      // Verify reviewer is part of the project
      if (project.clientId !== req.user!.id && project.freelancerId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      // Verify reviewer is not reviewing themselves
      if (req.user!.id === revieweeId) {
        return res.status(400).json({ message: "Cannot review yourself" });
      }

      // Check for existing review
      const [existing] = await db
        .select()
        .from(reviews)
        .where(
          and(
            eq(reviews.projectId, projectId),
            eq(reviews.reviewerId, req.user!.id)
          )
        );

      if (existing) {
        return res.status(409).json({ message: "You have already reviewed this project" });
      }

      const insertResult = await db
        .insert(reviews)
        .values({
          projectId,
          reviewerId: req.user!.id,
          revieweeId,
          rating,
          comment,
        });
      const [review] = await db.select().from(reviews).where(eq(reviews.id, insertResult[0].insertId));

      return res.status(201).json(review);
    } catch (error) {
      console.error("Create review error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
};
