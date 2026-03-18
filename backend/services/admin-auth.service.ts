import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { db } from "../db";
import { admins } from "@shared/schema";
import { eq } from "drizzle-orm";
import { generateAdminToken } from "../middleware/admin-auth";

const scrypt = promisify(_scrypt);

export const adminAuthService = {
  async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString("hex");
    const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
    return `${salt}.${derivedKey.toString("hex")}`;
  },

  async comparePassword(supplied: string, stored: string): Promise<boolean> {
    const [salt, storedHash] = stored.split(".");
    if (!salt || !storedHash) return false;
    const storedHashBuf = Buffer.from(storedHash, "hex");
    const derivedKey = (await scrypt(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(storedHashBuf, derivedKey);
  },

  async login(username: string, password: string) {
    const [admin] = await db
      .select()
      .from(admins)
      .where(eq(admins.username, username));

    if (!admin) {
      throw new Error("Invalid credentials");
    }

    const isValid = await this.comparePassword(password, admin.passwordHash);
    if (!isValid) {
      throw new Error("Invalid credentials");
    }

    const token = generateAdminToken({
      id: admin.id,
      username: admin.username,
    });

    return {
      admin: { id: admin.id, username: admin.username },
      token,
    };
  },

  async getAdminById(id: number) {
    const [admin] = await db
      .select()
      .from(admins)
      .where(eq(admins.id, id));
    if (!admin) return null;
    const { passwordHash, ...safeAdmin } = admin;
    return safeAdmin;
  },
};
