import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { pool } from "../src/config/db.js";

dotenv.config();

async function run() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const seedPath = path.join(__dirname, "..", "db", "seed.sql");
  const seedSql = await fs.readFile(seedPath, "utf8");

  await pool.query(seedSql);

  const defaultUsers = [
    { login: "superadmin", password: "superadmin", role: "super_admin", restaurantId: null },
    { login: "admin1", password: "123456", role: "admin", restaurantId: 1 },
    { login: "cashier1", password: "123456", role: "cashier", restaurantId: 1 },
    { login: "kitchen1", password: "123456", role: "kitchen", restaurantId: 1 },
    { login: "tv1", password: "123456", role: "tv_display", restaurantId: 1 },
  ];

  for (const user of defaultUsers) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    await pool.query(
      `INSERT INTO users (login, password_hash, role, restaurant_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (login) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           role = EXCLUDED.role,
           restaurant_id = EXCLUDED.restaurant_id`,
      [user.login, passwordHash, user.role, user.restaurantId]
    );
  }

  console.log("Seed data inserted successfully.");
  await pool.end();
}

run().catch(async (error) => {
  console.error("db:seed failed:", error.message);
  await pool.end();
  process.exit(1);
});
