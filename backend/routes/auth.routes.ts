import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth";
import rateLimit from "express-rate-limit";

export const authRoutes = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'development' ? 120 : 50,
  message: { message: "Too many auth attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public
authRoutes.post("/verify-wallet", authLimiter, authController.verifyWallet);
authRoutes.post("/logout", authController.logout);

// Protected
authRoutes.get("/me", requireAuth, authController.me);
