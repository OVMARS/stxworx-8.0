import { Router } from "express";
import { reviewController } from "../controllers/review.controller";
import { requireAuth } from "../middleware/auth";

export const reviewRoutes = Router();

// Protected
reviewRoutes.get("/mine", requireAuth, reviewController.mine);
reviewRoutes.post("/", requireAuth, reviewController.create);
