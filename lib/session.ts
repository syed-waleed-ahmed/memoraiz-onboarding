const STABLE_USER_KEY = "memoraiz-stable-user";
const TAB_SESSION_KEY = "memoraiz-tab-session";
const ACTIVE_CONVERSATION_KEY = "memoraiz-active-conversation";

export function getOrCreateStableUserId() {
  if (typeof window === "undefined") return "";
  const stored = window.localStorage.getItem(STABLE_USER_KEY);
  if (stored) return stored;
  const created = crypto.randomUUID();
  window.localStorage.setItem(STABLE_USER_KEY, created);
  return created;
}

export function getOrCreateTabSessionId() {
  if (typeof window === "undefined") return "";
  const stored = window.sessionStorage.getItem(TAB_SESSION_KEY);
  if (stored) return stored;
  const created = crypto.randomUUID();
  window.sessionStorage.setItem(TAB_SESSION_KEY, created);
  return created;
}

export function setTabSessionId(value: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(TAB_SESSION_KEY, value);
}

export function getStoredActiveConversationId() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(ACTIVE_CONVERSATION_KEY);
}

export function setStoredActiveConversationId(value: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(ACTIVE_CONVERSATION_KEY, value);
}

export function clearStoredActiveConversationId() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(ACTIVE_CONVERSATION_KEY);
}
