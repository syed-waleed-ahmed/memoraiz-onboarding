import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getPool } from "../lib/db/client";
import { config } from "dotenv";

config({ path: ".env.local" });

async function applySchema() {
  const pool = getPool();
  if (!pool) {
    throw new Error("POSTGRES_URL is required to apply schema");
  }

  const schemaPath = join(process.cwd(), "lib", "db", "schema.sql");
  const sql = await readFile(schemaPath, "utf8");
  if (!sql.trim()) {
    throw new Error("schema.sql is empty");
  }

  await pool.query(sql);
  await pool.end();
}

applySchema().catch((error) => {
  console.error(error);
  process.exit(1);
});
