export type ChatRole = "assistant" | "user" | "system" | "tool";

export interface CachedMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  edited?: boolean;
}

export interface CachedProfile {
  name: string;
  industry: string;
  description: string;
  aiMaturityLevel: string;
  aiUsage: string;
  goals: string;
}

export interface CachedConversationMeta {
  id: string;
  tabSessionId?: string | null;
  title?: string | null;
  createdAt?: string;
  updatedAt?: string;
  lastMessageAt?: string | null;
}

export interface CachedConversation {
  conversation: CachedConversationMeta;
  messages: CachedMessage[];
  profile: CachedProfile;
  fetchedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const conversationCache = new Map<string, CachedConversation>();

export function getCachedConversation(conversationId: string) {
  return conversationCache.get(conversationId) ?? null;
}

export function setCachedConversation(conversationId: string, payload: CachedConversation) {
  conversationCache.set(conversationId, payload);
}

export function isCacheFresh(conversationId: string) {
  const cached = conversationCache.get(conversationId);
  if (!cached) return false;
  return Date.now() - cached.fetchedAt < CACHE_TTL_MS;
}

export async function prefetchConversation(options: {
  conversationId: string;
  stableUserId: string;
  tabSessionId?: string | null;
}) {
  const { conversationId, stableUserId, tabSessionId } = options;
  if (isCacheFresh(conversationId)) return;

  const query = new URLSearchParams({ stableUserId });
  if (tabSessionId) query.set("tabSessionId", tabSessionId);

  const response = await fetch(`/api/conversations/${conversationId}?${query.toString()}`);
  if (!response.ok) return;
  const data = (await response.json()) as {
    conversation: CachedConversationMeta;
    messages: CachedMessage[];
    profile: CachedProfile;
  };

  setCachedConversation(conversationId, {
    conversation: data.conversation,
    messages: data.messages ?? [],
    profile: data.profile,
    fetchedAt: Date.now(),
  });
}
