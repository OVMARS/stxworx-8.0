import { type Request, type Response } from "express";
import { referralService } from "../services/referral.service";

export const referralController = {
  async getLeaderboard(_req: Request, res: Response) {
    try {
      const leaderboard = await referralService.getLeaderboard(10);
      return res.status(200).json(leaderboard);
    } catch (error) {
      console.error("Referral leaderboard error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async getMyProgram(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const overview = await referralService.getProgramOverview(req.user.id);
      return res.status(200).json(overview);
    } catch (error) {
      console.error("Get referral program error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async createOrShareCode(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const code = await referralService.markReferralCodeShared(req.user.id);
      return res.status(200).json(code);
    } catch (error) {
      console.error("Create referral code error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
};
