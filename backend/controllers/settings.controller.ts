import { type Request, type Response } from "express";
import { z } from "zod";
import { settingsService } from "../services/settings.service";

const updateSettingsSchema = z.object({
  notificationsEnabled: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  messagingOption: z.enum(["everyone", "clients_only", "connections_only"]).optional(),
  profileVisibility: z.enum(["public", "private"]).optional(),
  email: z.string().email().optional().or(z.literal("")),
  twitterHandle: z.string().max(100).optional(),
  isTwitterConnected: z.boolean().optional(),
});

export const settingsController = {
  async getMe(req: Request, res: Response) {
    try {
      const settings = await settingsService.getByUser(req.user!.id);
      return res.status(200).json(settings);
    } catch (error) {
      console.error("Get settings error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async updateMe(req: Request, res: Response) {
    try {
      const result = updateSettingsSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Validation error", errors: result.error.errors });
      }

      const updated = await settingsService.update(req.user!.id, {
        ...result.data,
        email: result.data.email === "" ? null : result.data.email,
        twitterHandle: result.data.twitterHandle?.trim() || null,
      });

      return res.status(200).json(updated);
    } catch (error) {
      console.error("Update settings error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
};
