import { Router } from "express";
import { proposalController } from "../controllers/proposal.controller";
import { requireAuth, requireRole } from "../middleware/auth";

export const proposalRoutes = Router();

// Protected
proposalRoutes.post("/", requireAuth, requireRole("freelancer"), proposalController.create);
proposalRoutes.get("/project/:projectId", requireAuth, proposalController.getByProject);
proposalRoutes.get("/my", requireAuth, proposalController.getMy);
proposalRoutes.patch("/:id/accept", requireAuth, proposalController.accept);
proposalRoutes.patch("/:id/reject", requireAuth, proposalController.reject);
proposalRoutes.patch("/:id/withdraw", requireAuth, proposalController.withdraw);
