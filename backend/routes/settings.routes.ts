import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { settingsController } from "../controllers/settings.controller";
import rateLimit from "express-rate-limit";

export const settingsRoutes = Router();

// Rate limiter for email verification (5 requests per hour)
const emailVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: { message: "Too many verification attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for resending (3 requests per hour)
const resendVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  message: { message: "Too many resend attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Standard settings endpoints
settingsRoutes.get("/me", requireAuth, settingsController.getMe);
settingsRoutes.patch("/me", requireAuth, settingsController.updateMe);

// Email verification endpoints
settingsRoutes.post(
  "/email-verification",
  requireAuth,
  emailVerificationLimiter,
  settingsController.requestEmailVerification
);
settingsRoutes.post(
  "/email-verification/resend",
  requireAuth,
  resendVerificationLimiter,
  settingsController.resendEmailVerification
);
settingsRoutes.post("/confirm-email", settingsController.confirmEmailVerification);
settingsRoutes.delete("/email", requireAuth, settingsController.removeEmail);
