import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev_user_jwt_secret";
const COOKIE_NAME = "stxworx_token";

export interface UserTokenPayload {
  id: number;
  stxAddress: string;
  role: "client" | "freelancer";
}

declare global {
  namespace Express {
    interface Request {
      user?: UserTokenPayload;
    }
  }
}

export function generateUserToken(payload: UserTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
}

export function verifyUserToken(token: string): UserTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as UserTokenPayload;
  } catch {
    return null;
  }
}

export function getUserCookieName(): string {
  return COOKIE_NAME;
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.[COOKIE_NAME];

  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const payload = verifyUserToken(token);
  if (!payload) {
    return res.status(401).json({ message: "Invalid or expired session" });
  }

  req.user = payload;
  next();
};

export const requireRole = (role: "client" | "freelancer") => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    if (req.user.role !== role) {
      return res.status(403).json({ message: `Only ${role}s can perform this action` });
    }
    next();
  };
};
