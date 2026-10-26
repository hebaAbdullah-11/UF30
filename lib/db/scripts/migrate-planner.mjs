import pg from "pg";
import { readFile } from "node:fs/promises";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  await pool.query(await readFile(new URL("../migrations/planner.sql", import.meta.url), "utf8"));
  console.log("Planner tables are ready (additive migration only).");
} finally {
  await pool.end();
}
