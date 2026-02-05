export function getOrCreateStableUserId() {
  const key = "memoraiz-stable-user";
  const stored = window.localStorage.getItem(key);
  if (stored) return stored;
  const created = crypto.randomUUID();
  window.localStorage.setItem(key, created);
  return created;
}

export function getOrCreateTabSessionId() {
  const key = "memoraiz-tab-session";
  const stored = window.sessionStorage.getItem(key);
  if (stored) return stored;
  const created = crypto.randomUUID();
  window.sessionStorage.setItem(key, created);
  return created;
}

export function setTabSessionId(value: string) {
  const key = "memoraiz-tab-session";
  window.sessionStorage.setItem(key, value);
}
