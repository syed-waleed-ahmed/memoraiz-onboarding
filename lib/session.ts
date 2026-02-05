const STABLE_USER_KEY = "memoraiz-stable-user";
const TAB_SESSION_KEY = "memoraiz-tab-session";

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
