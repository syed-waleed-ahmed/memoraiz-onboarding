import { getPool } from "./client";

export interface ConversationRecord {
  id: string;
  stableUserId: string;
  tabSessionId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  deletedAt: string | null;
}

function mapConversation(row: Record<string, unknown>): ConversationRecord {
  return {
    id: row.id as string,
    stableUserId: row.stable_user_id as string,
    tabSessionId: row.tab_session_id as string,
    title: row.title as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    lastMessageAt: (row.last_message_at as string | null) ?? null,
    deletedAt: (row.deleted_at as string | null) ?? null,
  };
}

export function deriveConversationTitle(message: string) {
  const trimmed = message.trim().replace(/\s+/g, " ");
  if (!trimmed) return "New conversation";
  const words = trimmed.split(" ").slice(0, 8).join(" ");
  return words.length > 60 ? `${words.slice(0, 57)}...` : words;
}

export async function findConversationBySession(
  stableUserId: string,
  tabSessionId: string,
) {
  const pool = getPool();
  if (!pool) return null;
  const result = await pool.query(
    `select id, stable_user_id, tab_session_id, title, created_at, updated_at, last_message_at, deleted_at
     from conversations
     where stable_user_id = $1 and tab_session_id = $2 and deleted_at is null
     order by created_at desc
     limit 1`,
    [stableUserId, tabSessionId],
  );

  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? mapConversation(row) : null;
}

export async function listConversations(stableUserId: string) {
  const pool = getPool();
  if (!pool) return [] as ConversationRecord[];
  const result = await pool.query(
    `select id, stable_user_id, tab_session_id, title, created_at, updated_at, last_message_at, deleted_at
     from conversations
     where stable_user_id = $1 and deleted_at is null and last_message_at is not null
     order by updated_at desc`,
    [stableUserId],
  );

  return result.rows.map((row) => mapConversation(row as Record<string, unknown>));
}

export async function getConversationById(
  stableUserId: string,
  conversationId: string,
) {
  const pool = getPool();
  if (!pool) return null;
  const result = await pool.query(
    `select id, stable_user_id, tab_session_id, title, created_at, updated_at, last_message_at, deleted_at
     from conversations
     where stable_user_id = $1 and id = $2 and deleted_at is null
     limit 1`,
    [stableUserId, conversationId],
  );

  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? mapConversation(row) : null;
}

export async function createConversation(
  stableUserId: string,
  tabSessionId: string,
  title = "New conversation",
) {
  const pool = getPool();
  if (!pool) return null;
  const result = await pool.query(
    `insert into conversations (id, stable_user_id, tab_session_id, title)
     values (gen_random_uuid(), $1, $2, $3)
     returning id, stable_user_id, tab_session_id, title, created_at, updated_at, last_message_at, deleted_at`,
    [stableUserId, tabSessionId, title],
  );

  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? mapConversation(row) : null;
}

export async function renameConversation(
  stableUserId: string,
  conversationId: string,
  title: string,
) {
  const pool = getPool();
  if (!pool) return null;
  await pool.query(
    `update conversations
     set title = $1, updated_at = now()
     where stable_user_id = $2 and id = $3 and deleted_at is null`,
    [title, stableUserId, conversationId],
  );
  return true;
}

export async function deleteConversation(
  stableUserId: string,
  conversationId: string,
) {
  const pool = getPool();
  if (!pool) return null;
  await pool.query(
    `update conversations
     set deleted_at = now(), updated_at = now()
     where stable_user_id = $1 and id = $2 and deleted_at is null`,
    [stableUserId, conversationId],
  );

  await pool.query("delete from messages where conversation_id = $1", [
    conversationId,
  ]);
  return true;
}

export async function touchConversationOnMessage(
  stableUserId: string,
  conversationId: string,
  titleCandidate: string | null,
) {
  const pool = getPool();
  if (!pool) return null;
  const shouldUpdateTitle = titleCandidate ? 1 : 0;
  await pool.query(
    `update conversations
     set updated_at = now(),
         last_message_at = now(),
         title = case
           when $1 = 1 and (title is null or title = 'New conversation') then $2
           else title
         end
     where stable_user_id = $3 and id = $4 and deleted_at is null`,
    [shouldUpdateTitle, titleCandidate ?? "", stableUserId, conversationId],
  );
  return true;
}
