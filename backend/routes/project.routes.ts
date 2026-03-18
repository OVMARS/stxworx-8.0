import { Router } from "express";
import { projectController } from "../controllers/project.controller";
import { requireAuth, requireRole } from "../middleware/auth";

export const projectRoutes = Router();

// Protected — must come before /:id routes
projectRoutes.get("/my/posted", requireAuth, projectController.myPosted);
projectRoutes.get("/my/active", requireAuth, projectController.myActive);
projectRoutes.get("/my/completed", requireAuth, projectController.myCompleted);
projectRoutes.get("/my/completed", requireAuth, projectController.myCompleted);

// Public
projectRoutes.get("/", projectController.getAll);
projectRoutes.get("/:id", projectController.getById);

// Protected
projectRoutes.post("/", requireAuth, requireRole("client"), projectController.create);
projectRoutes.patch("/:id", requireAuth, projectController.update);
projectRoutes.delete("/:id", requireAuth, projectController.cancel);
projectRoutes.patch("/:id/activate", requireAuth, projectController.activate);
