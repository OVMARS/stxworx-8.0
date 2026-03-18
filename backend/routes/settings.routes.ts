import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { settingsController } from "../controllers/settings.controller";

export const settingsRoutes = Router();

settingsRoutes.get("/me", requireAuth, settingsController.getMe);
settingsRoutes.patch("/me", requireAuth, settingsController.updateMe);
