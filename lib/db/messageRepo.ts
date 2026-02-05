import { getPool } from "./client";
import {
  deriveConversationTitle,
  touchConversationOnMessage,
} from "@/lib/db/conversationRepo";

export type ChatRole = "user" | "assistant" | "system" | "tool";

export interface ChatMessageRecord {
  id: string;
  conversationId: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

function mapMessage(row: Record<string, unknown>): ChatMessageRecord {
  return {
    id: row.id as string,
    conversationId: row.conversation_id as string,
    role: row.role as ChatRole,
    content: row.content as string,
    createdAt: row.created_at as string,
  };
}

export async function listMessages(conversationId: string) {
  const pool = getPool();
  if (!pool) return [] as ChatMessageRecord[];
  const result = await pool.query(
    `select id, conversation_id, role, content, created_at
     from messages
     where conversation_id = $1
     order by created_at asc`,
    [conversationId],
  );

  return result.rows.map((row) => mapMessage(row as Record<string, unknown>));
}

export async function appendMessage(
  stableUserId: string,
  conversationId: string,
  role: ChatRole,
  content: string,
) {
  const pool = getPool();
  if (!pool) return null;
  const result = await pool.query(
    `insert into messages (id, conversation_id, role, content)
     values (gen_random_uuid(), $1, $2, $3)
     returning id, conversation_id, role, content, created_at`,
    [conversationId, role, content],
  );

  const titleCandidate = role === "user" ? deriveConversationTitle(content) : null;
  await touchConversationOnMessage(stableUserId, conversationId, titleCandidate);

  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? mapMessage(row) : null;
}
