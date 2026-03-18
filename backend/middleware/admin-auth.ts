import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_ADMIN_SECRET = process.env.JWT_ADMIN_SECRET || "dev_admin_jwt_secret";
const ADMIN_COOKIE_NAME = "stxworx_admin_token";

export interface AdminTokenPayload {
  id: number;
  username: string;
  isAdmin: true;
}

declare global {
  namespace Express {
    interface Request {
      admin?: AdminTokenPayload;
    }
  }
}

export function generateAdminToken(payload: Omit<AdminTokenPayload, "isAdmin">): string {
  return jwt.sign({ ...payload, isAdmin: true }, JWT_ADMIN_SECRET, { expiresIn: "24h" });
}

export function verifyAdminToken(token: string): AdminTokenPayload | null {
  try {
    const payload = jwt.verify(token, JWT_ADMIN_SECRET) as AdminTokenPayload;
    if (!payload.isAdmin) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getAdminCookieName(): string {
  return ADMIN_COOKIE_NAME;
}

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.[ADMIN_COOKIE_NAME];

  if (!token) {
    return res.status(401).json({ message: "Admin authentication required" });
  }

  const payload = verifyAdminToken(token);
  if (!payload) {
    return res.status(401).json({ message: "Invalid or expired admin session" });
  }

  req.admin = payload;
  next();
};
