import { type Request, type Response } from "express";
import { notificationService } from "../services/notification.service";

export const notificationController = {
  // GET /api/notifications
  async list(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const notifs = await notificationService.getByUser(userId);
      return res.json(notifs);
    } catch (error) {
      console.error("List notifications error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  // GET /api/notifications/unread-count
  async unreadCount(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const count = await notificationService.getUnreadCount(userId);
      return res.json({ count });
    } catch (error) {
      console.error("Unread count error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  // PATCH /api/notifications/:id/read
  async markRead(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid notification ID" });
      await notificationService.markAsRead(id, req.user!.id);
      return res.json({ message: "Marked as read" });
    } catch (error) {
      console.error("Mark read error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  // PATCH /api/notifications/read-all
  async markAllRead(req: Request, res: Response) {
    try {
      await notificationService.markAllAsRead(req.user!.id);
      return res.json({ message: "All marked as read" });
    } catch (error) {
      console.error("Mark all read error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  // DELETE /api/notifications
  async clearAll(req: Request, res: Response) {
    try {
      await notificationService.deleteAllForUser(req.user!.id);
      return res.json({ message: "All notifications cleared" });
    } catch (error) {
      console.error("Clear notifications error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
};
