export const RECALL_SESSION_COOKIE = "snapbrain-recall-session";
export const PREVIOUS_MEMORY_COOKIE = "snapbrain-previous-memory";
export const SEARCH_QUERY_COOKIE = "snapbrain-search-query";
export const OPEN_SOURCE_COOKIE = "snapbrain-open-source";

export function getClientRecallSessionId() {
  if (typeof window === "undefined") return "";
  let sessionId = window.localStorage.getItem(RECALL_SESSION_COOKIE);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    window.localStorage.setItem(RECALL_SESSION_COOKIE, sessionId);
  }
  document.cookie = `${RECALL_SESSION_COOKIE}=${sessionId}; path=/; max-age=86400; samesite=lax`;
  return sessionId;
}

export function rememberPreviousMemory(itemId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PREVIOUS_MEMORY_COOKIE, itemId);
  document.cookie = `${PREVIOUS_MEMORY_COOKIE}=${itemId}; path=/; max-age=86400; samesite=lax`;
}

export function getClientPreviousMemoryId() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(PREVIOUS_MEMORY_COOKIE) ?? "";
}

export function rememberSearchOpen(query: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SEARCH_QUERY_COOKIE, query);
  document.cookie = `${SEARCH_QUERY_COOKIE}=${encodeURIComponent(query)}; path=/; max-age=600; samesite=lax`;
  document.cookie = `${OPEN_SOURCE_COOKIE}=search; path=/; max-age=600; samesite=lax`;
}

export function rememberRelatedOpen() {
  if (typeof window === "undefined") return;
  document.cookie = `${OPEN_SOURCE_COOKIE}=related; path=/; max-age=600; samesite=lax`;
}

export function clearOpenContext() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SEARCH_QUERY_COOKIE);
  document.cookie = `${SEARCH_QUERY_COOKIE}=; path=/; max-age=0; samesite=lax`;
  document.cookie = `${OPEN_SOURCE_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
