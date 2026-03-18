import { Router } from "express";
import { notificationController } from "../controllers/notification.controller";
import { requireAuth } from "../middleware/auth";

export const notificationRoutes = Router();

notificationRoutes.get("/", requireAuth, notificationController.list);
notificationRoutes.get("/unread-count", requireAuth, notificationController.unreadCount);
notificationRoutes.patch("/:id/read", requireAuth, notificationController.markRead);
notificationRoutes.patch("/read-all", requireAuth, notificationController.markAllRead);
notificationRoutes.delete("/", requireAuth, notificationController.clearAll);
