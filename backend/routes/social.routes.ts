import { Router } from "express";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { socialController } from "../controllers/social.controller";

export const socialRoutes = Router();

socialRoutes.get("/feed", optionalAuth, socialController.feed);
socialRoutes.get("/posts", optionalAuth, socialController.list);
socialRoutes.get("/posts/:id", optionalAuth, socialController.getById);
socialRoutes.get("/posts/:id/comments", optionalAuth, socialController.listComments);
socialRoutes.get("/:address/posts", optionalAuth, socialController.listByAddress);
socialRoutes.post("/posts", requireAuth, socialController.create);
socialRoutes.patch("/posts/:id", requireAuth, socialController.update);
socialRoutes.delete("/posts/:id", requireAuth, socialController.remove);
socialRoutes.patch("/posts/:id/pin", requireAuth, socialController.togglePin);
socialRoutes.post("/posts/:id/comments", requireAuth, socialController.createComment);
socialRoutes.patch("/posts/:id/like", requireAuth, socialController.toggleLike);
