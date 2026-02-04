import { Pool } from "pg";

let pool: Pool | null = null;

export function getPool() {
  if (!process.env.POSTGRES_URL?.trim()) {
    return null;
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.POSTGRES_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
    });
  }

  return pool;
}
