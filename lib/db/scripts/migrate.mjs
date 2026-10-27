// Applies numbered SQL migrations (lib/db/migrations/NNNN_name.sql) in order,
// once each, recording them in schema_migrations. Each file runs in its own
// transaction. Usage: DATABASE_URL=... pnpm --filter @workspace/db run migrate
import pg from "pg";
import { readdir, readFile } from "node:fs/promises";

const dir = new URL("../migrations/", import.meta.url);
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  await client.query("ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY");
  const applied = new Set((await client.query("SELECT name FROM schema_migrations")).rows.map((row) => row.name));
  const files = (await readdir(dir)).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
  for (const name of files) {
    if (applied.has(name)) continue;
    const sql = await readFile(new URL(name, dir), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [name]);
      await client.query("COMMIT");
      console.log(`applied ${name}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw new Error(`Migration ${name} failed: ${error.message}`, { cause: error });
    }
  }
  console.log("Migrations are up to date.");
} finally {
  await client.end();
}
