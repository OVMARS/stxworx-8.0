import { db } from "./db";
import { admins, categories } from "@shared/schema";
import { adminAuthService } from "./services/admin-auth.service";
import { eq, sql } from "drizzle-orm";

const SEED_CATEGORIES = [
  {
    name: "Smart Contracts",
    icon: "FileCode",
    subcategories: ["Clarity", "Solidity", "Auditing", "Token Standards"],
  },
  {
    name: "Web Development",
    icon: "Code",
    subcategories: ["React", "Next.js", "Node.js", "Full Stack"],
  },
  {
    name: "Design",
    icon: "Palette",
    subcategories: ["UI/UX", "NFT Art", "Branding", "Figma"],
  },
  {
    name: "Auditing",
    icon: "ShieldCheck",
    subcategories: ["Smart Contract Audit", "Security Review", "Penetration Testing"],
  },
  {
    name: "Writing",
    icon: "FileText",
    subcategories: ["Technical Writing", "Documentation", "Whitepapers", "Blog Posts"],
  },
  {
    name: "Marketing",
    icon: "Megaphone",
    subcategories: ["Community Growth", "Social Media", "Content Strategy", "SEO"],
  },
  {
    name: "Media & Content",
    icon: "Film",
    subcategories: ["Video Production", "Animation", "Podcasts", "Photography"],
  },
];

async function seed() {
  console.log("Starting seed...");

  // Seed default admin account
  const [existingAdmin] = await db
    .select()
    .from(admins)
    .where(eq(admins.username, "admin"));

  if (!existingAdmin) {
    console.log("Creating default admin user...");
    const passwordHash = await adminAuthService.hashPassword("SuperSecretAdminPassword123!");
    await db.insert(admins).values({
      username: "admin",
      passwordHash,
    });
    console.log("Default admin created: admin / SuperSecretAdminPassword123!");
  } else {
    console.log("Admin user already exists");
  }

  // Seed categories
  const existingCategories = await db.select().from(categories);
  if (existingCategories.length === 0) {
    console.log("Seeding categories...");
    await db.insert(categories).values(SEED_CATEGORIES);
    console.log(`Seeded ${SEED_CATEGORIES.length} categories`);
  } else {
    console.log(`Categories already exist (${existingCategories.length} found)`);
  }

  console.log("Seeding complete");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
