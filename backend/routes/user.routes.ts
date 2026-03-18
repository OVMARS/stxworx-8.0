import { Router } from "express";
import { userController } from "../controllers/user.controller";
import { requireAuth } from "../middleware/auth";

export const userRoutes = Router();

// Public
userRoutes.get("/leaderboard", userController.getLeaderboard);
userRoutes.get("/:address", userController.getByAddress);
userRoutes.get("/:address/reviews", userController.getReviews);
userRoutes.get("/:address/projects", userController.getProjectsByAddress);

// Protected
userRoutes.patch("/me", requireAuth, userController.updateMe);
