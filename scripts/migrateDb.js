import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { pool } from "../src/config/db.js";

dotenv.config();

async function run() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const migrationsDir = path.join(__dirname, "..", "db", "migrations");
  const files = (await fs.readdir(migrationsDir)).sort();

  for (const file of files) {
    if (!file.endsWith(".sql")) continue;
    const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
    await pool.query(sql);
    console.log(`Migration applied: ${file}`);
  }

  await pool.end();
}

run().catch(async (error) => {
  console.error("db:migrate failed:", error.message);
  await pool.end();
  process.exit(1);
});
