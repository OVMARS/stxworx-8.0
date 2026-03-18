import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { bountyController } from "../controllers/bounty.controller";

export const bountyRoutes = Router();

bountyRoutes.get("/", bountyController.list);
bountyRoutes.get("/my/dashboard", requireAuth, bountyController.dashboard);
bountyRoutes.post("/", requireAuth, bountyController.create);
bountyRoutes.post("/:id/participate", requireAuth, bountyController.submit);
