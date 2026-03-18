import { type Request, type Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { users, reviews, projects } from "@shared/schema";
import { eq, sql, and, or, count, avg } from "drizzle-orm";
import { projectService } from "../services/project.service";

const updateProfileSchema = z.object({
  username: z.string().min(1).max(100).optional(),
  specialty: z.string().max(100).optional(),
  hourlyRate: z.string().optional(),
  about: z.string().max(2000).optional(),
  skills: z.array(z.string()).optional(),
  portfolio: z.array(z.string().url()).optional(),
  company: z.string().max(150).optional(),
  projectInterests: z.array(z.string()).optional(),
  avatar: z.string().max(200000).optional(), // URL or data URL
});

export const userController = {
  // GET /api/users/:address
  async getByAddress(req: Request, res: Response) {
    try {
      const { address } = req.params;
      const [user] = await db
        .select({
          id: users.id,
          stxAddress: users.stxAddress,
          username: users.username,
          role: users.role,
          isActive: users.isActive,
          totalEarned: users.totalEarned,
          specialty: users.specialty,
          hourlyRate: users.hourlyRate,
          about: users.about,
          skills: users.skills,
          portfolio: users.portfolio,
          company: users.company,
          projectInterests: users.projectInterests,
          avatar: users.avatar,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.stxAddress, address));

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      return res.status(200).json(user);
    } catch (error) {
      console.error("Get user error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  // PATCH /api/users/me
  async updateMe(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const result = updateProfileSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Validation error", errors: result.error.errors });
      }

      const { hourlyRate, avatar, ...rest } = result.data;
      await db
        .update(users)
        .set({
          ...rest,
          ...(hourlyRate !== undefined ? { hourlyRate } : {}),
          ...(avatar !== undefined ? { avatar } : {}),
          updatedAt: new Date(),
        })
        .where(eq(users.id, req.user.id));
      const [updated] = await db.select().from(users).where(eq(users.id, req.user.id));

      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }

      return res.status(200).json({
        id: updated.id,
        stxAddress: updated.stxAddress,
        username: updated.username,
        role: updated.role,
        isActive: updated.isActive,
        specialty: updated.specialty,
        hourlyRate: updated.hourlyRate,
        about: updated.about,
        skills: updated.skills,
        portfolio: updated.portfolio,
        company: updated.company,
        projectInterests: updated.projectInterests,
        avatar: updated.avatar ?? undefined,
      });
    } catch (error) {
      console.error("Update profile error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  // GET /api/users/:address/reviews
  async getReviews(req: Request, res: Response) {
    try {
      const { address } = req.params;
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.stxAddress, address));

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const userReviews = await db
        .select()
        .from(reviews)
        .where(eq(reviews.revieweeId, user.id));

      return res.status(200).json(userReviews);
    } catch (error) {
      console.error("Get reviews error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  // GET /api/users/:address/projects
  async getProjectsByAddress(req: Request, res: Response) {
    try {
      const { address } = req.params;
      const [user] = await db
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(eq(users.stxAddress, address));

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      let userProjects;
      if (user.role === "client") {
        userProjects = await projectService.getByClientId(user.id);
      } else {
        userProjects = await projectService.getByFreelancerId(user.id);
      }

      const withBudget = userProjects.map((p) => ({
        ...p,
        budget: projectService.computeBudget(p),
      }));

      return res.status(200).json(withBudget);
    } catch (error) {
      console.error("Get user projects error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  // GET /api/users/leaderboard
  async getLeaderboard(_req: Request, res: Response) {
    try {
      // Get all freelancers with their completed project count and avg rating
      const freelancers = await db
        .select({
          id: users.id,
          stxAddress: users.stxAddress,
          username: users.username,
          role: users.role,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(and(eq(users.role, "freelancer"), eq(users.isActive, true)));

      // For each freelancer, compute completed projects count and avg rating
      const leaderboard = await Promise.all(
        freelancers.map(async (f) => {
          // Count completed projects where this freelancer was assigned
          const [completedResult] = await db
            .select({ count: count() })
            .from(projects)
            .where(
              and(
                eq(projects.freelancerId, f.id),
                eq(projects.status, "completed")
              )
            );

          // Get average rating from reviews where this freelancer is the reviewee
          const [ratingResult] = await db
            .select({ avgRating: avg(reviews.rating) })
            .from(reviews)
            .where(eq(reviews.revieweeId, f.id));

          // Count total reviews
          const [reviewCountResult] = await db
            .select({ count: count() })
            .from(reviews)
            .where(eq(reviews.revieweeId, f.id));

          return {
            id: f.id,
            stxAddress: f.stxAddress,
            username: f.username,
            jobsCompleted: completedResult?.count ?? 0,
            avgRating: ratingResult?.avgRating ? parseFloat(String(ratingResult.avgRating)) : 0,
            reviewCount: reviewCountResult?.count ?? 0,
            createdAt: f.createdAt,
          };
        })
      );

      // Sort: primary by jobsCompleted desc, secondary by avgRating desc
      leaderboard.sort((a, b) => {
        if (b.jobsCompleted !== a.jobsCompleted) return b.jobsCompleted - a.jobsCompleted;
        return b.avgRating - a.avgRating;
      });

      // Add rank
      const ranked = leaderboard.map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));

      return res.status(200).json(ranked);
    } catch (error) {
      console.error("Leaderboard error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
};
