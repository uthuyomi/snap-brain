import { cookies } from "next/headers";

import { OPEN_SOURCE_COOKIE, PREVIOUS_MEMORY_COOKIE, RECALL_SESSION_COOKIE, SEARCH_QUERY_COOKIE } from "./recall-session";

export async function getServerRecallHeaders() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(RECALL_SESSION_COOKIE)?.value;
  const previousMemoryId = cookieStore.get(PREVIOUS_MEMORY_COOKIE)?.value;
  const searchQuery = cookieStore.get(SEARCH_QUERY_COOKIE)?.value;
  const openSource = cookieStore.get(OPEN_SOURCE_COOKIE)?.value;
  return {
    ...(sessionId ? { "X-SnapBrain-Session-Id": sessionId } : {}),
    ...(previousMemoryId ? { "X-SnapBrain-Previous-Memory-Id": previousMemoryId } : {}),
    ...(searchQuery ? { "X-SnapBrain-Search-Query": decodeURIComponent(searchQuery) } : {}),
    ...(openSource ? { "X-SnapBrain-Open-Source": openSource } : {}),
  };
}
