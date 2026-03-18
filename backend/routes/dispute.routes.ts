import { Router } from "express";
import { disputeController } from "../controllers/dispute.controller";
import { requireAuth } from "../middleware/auth";

export const disputeRoutes = Router();

// Protected
disputeRoutes.post("/", requireAuth, disputeController.create);
disputeRoutes.get("/project/:projectId", requireAuth, disputeController.getByProject);
