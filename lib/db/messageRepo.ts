import { getPool } from "./client";

export interface ChatMessageRecord {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export async function listMessages(sessionId: string) {
  const pool = getPool();
  if (!pool) return [] as ChatMessageRecord[];
  const result = await pool.query(
    `select id, session_id, role, content, created_at
     from chat_messages
     where session_id = $1
     order by created_at asc`,
    [sessionId],
  );

  return result.rows.map((row) => ({
    id: row.id as string,
    sessionId: row.session_id as string,
    role: row.role as "user" | "assistant",
    content: row.content as string,
    createdAt: row.created_at as string,
  }));
}

export async function insertMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
) {
  const pool = getPool();
  if (!pool) return null;
  const result = await pool.query(
    `insert into chat_messages (id, session_id, role, content)
     values (gen_random_uuid(), $1, $2, $3)
     returning id, session_id, role, content, created_at`,
    [sessionId, role, content],
  );
  return result.rows[0] ?? null;
}
