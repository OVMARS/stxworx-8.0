import { type Request, type Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { disputes } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { projectService } from "../services/project.service";
import { notificationService } from "../services/notification.service";

const createDisputeSchema = z.object({
  projectId: z.number().int(),
  milestoneNum: z.number().int().min(1).max(4),
  reason: z.string().min(1),
  evidenceUrl: z.string().max(500).optional(),
  disputeTxId: z.string().max(100).optional(),
});

export const disputeController = {
  // POST /api/disputes
  async create(req: Request, res: Response) {
    try {
      const result = createDisputeSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Validation error", errors: result.error.errors });
      }

      const { projectId, milestoneNum, reason, evidenceUrl, disputeTxId } = result.data;

      // Verify user is part of this project
      const project = await projectService.getById(projectId);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (project.clientId !== req.user!.id && project.freelancerId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized" });
      }
      if (project.status !== "active") {
        return res.status(400).json({ message: "Can only dispute active projects" });
      }

      // Check if this milestone already has an open dispute
      const existing = await db
        .select()
        .from(disputes)
        .where(and(eq(disputes.projectId, projectId), eq(disputes.milestoneNum, milestoneNum)));
      const hasOpen = existing.some(d => d.status === "open");
      if (hasOpen) {
        return res.status(400).json({ message: "This milestone already has an open dispute" });
      }

      const insertResult = await db
        .insert(disputes)
        .values({
          projectId,
          milestoneNum,
          filedBy: req.user!.id,
          reason,
          evidenceUrl,
          disputeTxId,
        });
      const [dispute] = await db.select().from(disputes).where(eq(disputes.id, insertResult[0].insertId));

      // NOTE: Project stays "active" — only this milestone is blocked.
      // The smart contract handles per-milestone dispute locks.

      // Notify the counterparty
      try {
        const counterpartyId = req.user!.id === project.clientId ? project.freelancerId : project.clientId;
        if (counterpartyId) {
          const filerRole = req.user!.id === project.clientId ? "Client" : "Freelancer";
          await notificationService.create({
            userId: counterpartyId,
            type: "dispute_filed",
            title: `Dispute Filed on Milestone ${milestoneNum}`,
            message: `${filerRole} has filed a dispute on Milestone ${milestoneNum} of "${project.title}". Reason: ${reason.slice(0, 100)}${reason.length > 100 ? '...' : ''}`,
            projectId,
          });
        }
      } catch (e) {
        console.error("Failed to create dispute notification:", e);
      }

      return res.status(201).json(dispute);
    } catch (error) {
      console.error("Create dispute error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  // GET /api/disputes/project/:projectId
  async getByProject(req: Request, res: Response) {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) return res.status(400).json({ message: "Invalid project ID" });

      const projectDisputes = await db
        .select()
        .from(disputes)
        .where(eq(disputes.projectId, projectId));

      return res.status(200).json(projectDisputes);
    } catch (error) {
      console.error("Get disputes error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
};
