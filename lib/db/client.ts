import { Pool } from "pg";
import { env } from "@/lib/env";

let pool: Pool | null = null;

export function getPool() {
  const connectionString = env.POSTGRES_URL?.trim();
  if (!connectionString) {
    return null;
  }

  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
    });
  }

  return pool;
}
