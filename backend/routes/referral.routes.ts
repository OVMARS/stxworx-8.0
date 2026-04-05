import { Router } from "express";
import { referralController } from "../controllers/referral.controller";
import { requireAuth } from "../middleware/auth";

export const referralRoutes = Router();

referralRoutes.get("/leaderboard", referralController.getLeaderboard);
referralRoutes.get("/me", requireAuth, referralController.getMyProgram);
referralRoutes.post("/code", requireAuth, referralController.createOrShareCode);
