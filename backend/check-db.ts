import { pool } from "./db";

async function checkConnection() {
  console.log("Checking MySQL connection...");
  console.log("DATABASE_URL:", process.env.DATABASE_URL ? "Set" : "Not set");

  try {
    const [rows] = await pool.query("SELECT VERSION() as version");
    console.log("MySQL connection successful!");
    console.log("MySQL version:", (rows as any)[0].version);

    const { db } = await import("./db");
    const { categories, users, admins, projects } = await import("@shared/schema");

    const cats = await db.select().from(categories);
    console.log(`Found ${cats.length} categories`);

    const userCount = await db.select().from(users);
    console.log(`Found ${userCount.length} users`);

    const adminCount = await db.select().from(admins);
    console.log(`Found ${adminCount.length} admins`);

    const projectCount = await db.select().from(projects);
    console.log(`Found ${projectCount.length} projects`);

    process.exit(0);
  } catch (error) {
    console.error("Database connection failed:", error);
    console.log("\nMake sure:");
    console.log("  1. MySQL is running");
    console.log("  2. DATABASE_URL is set in .env file");
    console.log("  3. Database exists and is accessible");
    process.exit(1);
  }
}

checkConnection();
