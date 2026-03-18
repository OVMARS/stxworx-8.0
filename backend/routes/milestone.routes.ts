import { Router } from "express";
import { milestoneController } from "../controllers/milestone.controller";
import { requireAuth } from "../middleware/auth";

export const milestoneRoutes = Router();

// Protected
milestoneRoutes.post("/submit", requireAuth, milestoneController.submit);
milestoneRoutes.patch("/:id/approve", requireAuth, milestoneController.approve);
milestoneRoutes.patch("/:id/reject", requireAuth, milestoneController.reject);
milestoneRoutes.get("/project/:projectId", requireAuth, milestoneController.getByProject);
