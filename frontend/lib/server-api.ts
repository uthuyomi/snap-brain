import { getServerAiLocale, getServerLocale } from "./i18n-server";
import { getServerRecallHeaders } from "./recall-session-server";
import { createClient } from "./supabase/server";
import type { MemoryChunkRow, MemoryItemRow, MemoryPattern, PlaygroundResponse, SearchResponse } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function getServerAccessToken() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

async function authHeaders() {
  const token = await getServerAccessToken();
  if (!token) return null;
  const locale = await getServerLocale();
  const aiLocale = await getServerAiLocale();
  const recallHeaders = await getServerRecallHeaders();
  return {
    Authorization: `Bearer ${token}`,
    "X-SnapBrain-Locale": locale,
    "X-SnapBrain-AI-Locale": aiLocale,
    ...recallHeaders,
  };
}

export async function searchMemoriesServer(query: string): Promise<SearchResponse> {
  if (!query.trim()) {
    return { query, results: [], recall_summary: "検索したい言葉を入力してください。" };
  }

  try {
    const headers = await authHeaders();
    if (!headers) throw new Error("Googleでログインしてください。");
    const response = await fetch(`${API_BASE}/api/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify({ query, limit: 12, include_related: true }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`検索に失敗しました: ${response.status}`);
    return (await response.json()) as SearchResponse;
  } catch (error) {
    return {
      query,
      results: [],
      recall_summary: error instanceof Error ? error.message : "検索できませんでした。",
    };
  }
}

export async function runRecallPlaygroundServer(queries: string[]): Promise<PlaygroundResponse> {
  try {
    const headers = await authHeaders();
    if (!headers) throw new Error("Googleでログインしてください。");
    const response = await fetch(`${API_BASE}/api/search/playground`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify({ queries, limit: 6, include_related: true }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Playgroundに失敗しました: ${response.status}`);
    return (await response.json()) as PlaygroundResponse;
  } catch (error) {
    return {
      cases: queries.map((query) => ({
        query,
        response: {
          query,
          results: [],
          recall_summary: error instanceof Error ? error.message : "Playgroundを実行できませんでした。",
        },
      })),
    };
  }
}

export async function listRecentMemoriesServer(): Promise<MemoryItemRow[]> {
  return (await listHomeMemoryDataServer()).items;
}

export async function listHomeMemoryDataServer(): Promise<{ items: MemoryItemRow[]; pattern?: MemoryPattern | null }> {
  try {
    const headers = await authHeaders();
    if (!headers) return { items: [], pattern: null };
    const response = await fetch(`${API_BASE}/api/memories`, {
      headers,
      cache: "no-store",
    });
    if (!response.ok) return { items: [], pattern: null };
    return (await response.json()) as { items: MemoryItemRow[]; pattern?: MemoryPattern | null };
  } catch {
    return { items: [], pattern: null };
  }
}

export async function getMemoryServer(id: string): Promise<{ item: MemoryItemRow; chunks: MemoryChunkRow[]; related?: MemoryItemRow[] } | null> {
  try {
    const headers = await authHeaders();
    if (!headers) return null;
    const response = await fetch(`${API_BASE}/api/memories/${id}`, {
      headers,
      cache: "no-store",
    });
    if (!response.ok) return null;
    return (await response.json()) as { item: MemoryItemRow; chunks: MemoryChunkRow[]; related?: MemoryItemRow[] };
  } catch {
    return null;
  }
}
