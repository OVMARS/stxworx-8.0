import { type Request, type Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { reviews } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { projectService } from "../services/project.service";
import { notificationService } from "../services/notification.service";

const createReviewSchema = z.object({
  projectId: z.preprocess((val) => {
    // Convert string numbers to actual numbers
    if (typeof val === 'string') {
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed)) return parsed;
    }
    return val;
  }, z.number().int()),
  rating: z.preprocess((val) => {
    // Convert string numbers to actual numbers
    if (typeof val === 'string') {
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed)) return parsed;
    }
    return val;
  }, z.number().int().min(1).max(5)),
  comment: z.string().optional(),
});

export const reviewController = {
  async mine(req: Request, res: Response) {
    try {
      const myReviews = await db
        .select()
        .from(reviews)
        .where(eq(reviews.reviewerId, req.user!.id));

      return res.status(200).json(myReviews);
    } catch (error) {
      console.error("Get my reviews error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  // POST /api/reviews
  async create(req: Request, res: Response) {
    try {
      const result = createReviewSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Validation error", errors: result.error.errors });
      }

      const { projectId, rating, comment } = result.data;

      // Verify project is completed
      const project = await projectService.getById(projectId);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (project.status !== "completed") {
        return res.status(400).json({ message: "Can only review completed projects" });
      }

      if (req.user!.role !== "client") {
        return res.status(403).json({ message: "Only clients can rate completed jobs" });
      }

      if (project.clientId !== req.user!.id) {
        return res.status(403).json({ message: "Only the client for this project can submit a rating" });
      }

      if (!project.freelancerId) {
        return res.status(400).json({ message: "This completed project has no assigned freelancer to rate" });
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
          revieweeId: project.freelancerId,
          rating,
          comment,
        });
      const [review] = await db.select().from(reviews).where(eq(reviews.id, insertResult[0].insertId));

      // Notify the freelancer that they received a review
      try {
        if (project.freelancerId) {
          await notificationService.create({
            userId: project.freelancerId,
            type: "review_received",
            title: "New Review Received",
            message: `You received a ${rating}-star review for "${project.title}"`,
            projectId: project.id,
          });
        }
      } catch (e) {
        console.error("Failed to create review notification:", e);
      }

      return res.status(201).json(review);
    } catch (error) {
      console.error("Create review error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
};
