import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { socialController } from "../controllers/social.controller";

export const socialRoutes = Router();

socialRoutes.get("/:address/posts", socialController.listByAddress);
socialRoutes.post("/posts", requireAuth, socialController.create);
socialRoutes.patch("/posts/:id/like", requireAuth, socialController.toggleLike);
