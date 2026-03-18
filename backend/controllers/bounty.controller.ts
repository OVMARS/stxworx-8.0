import { type Request, type Response } from "express";
import { z } from "zod";
import { bountyService } from "../services/bounty.service";

const createBountySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  links: z.string().url().optional().or(z.literal("")),
  reward: z.string().min(1).max(100),
});

const submitBountySchema = z.object({
  description: z.string().min(1),
  links: z.string().url().optional().or(z.literal("")),
});

export const bountyController = {
  async list(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const bounties = await bountyService.list(userId);
      return res.status(200).json(bounties);
    } catch (error) {
      console.error("List bounties error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async dashboard(req: Request, res: Response) {
    try {
      const dashboard = await bountyService.getDashboard(req.user!.id);
      return res.status(200).json(dashboard);
    } catch (error) {
      console.error("Bounty dashboard error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const result = createBountySchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Validation error", errors: result.error.errors });
      }

      const created = await bountyService.create(req.user!.id, {
        ...result.data,
        links: result.data.links || undefined,
      });
      return res.status(201).json(created);
    } catch (error) {
      console.error("Create bounty error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async submit(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid bounty ID" });
      }

      const result = submitBountySchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Validation error", errors: result.error.errors });
      }

      const submission = await bountyService.submit(id, req.user!.id, {
        description: result.data.description,
        links: result.data.links || undefined,
      });
      return res.status(201).json(submission);
    } catch (error) {
      console.error("Submit bounty participation error:", error);
      return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to submit participation" });
    }
  },
};
