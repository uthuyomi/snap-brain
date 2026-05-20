import type { LocalePreference } from "./i18n";
import { getClientAiLocale, getClientLocale } from "./i18n";
import { getClientPreviousMemoryId, getClientRecallSessionId } from "./recall-session";
import { createClient } from "./supabase/client";
import type { PlaygroundResponse, SearchResponse } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export type ProfileResponse = {
  id: string;
  display_name?: string | null;
  locale: LocalePreference;
  preferred_ai_language: LocalePreference;
  resolved_locale: "ja" | "en";
};

async function getAccessToken() {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

function localeHeader() {
  return {
    "X-SnapBrain-Locale": getClientLocale(),
    "X-SnapBrain-AI-Locale": getClientAiLocale(),
    "X-SnapBrain-Session-Id": getClientRecallSessionId(),
    "X-SnapBrain-Previous-Memory-Id": getClientPreviousMemoryId(),
  };
}

export async function getProfile(): Promise<ProfileResponse> {
  const token = await getAccessToken();
  if (!token) throw new Error("Please sign in with Google.");
  const response = await fetch(`${API_BASE}/api/profile`, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...localeHeader(),
    },
  });
  if (!response.ok) throw new Error(`Profile request failed: ${response.status}`);
  return (await response.json()) as ProfileResponse;
}

export async function updateProfile(input: {
  locale: LocalePreference;
  preferred_ai_language: LocalePreference;
}): Promise<ProfileResponse> {
  const token = await getAccessToken();
  if (!token) throw new Error("Please sign in with Google.");
  const response = await fetch(`${API_BASE}/api/profile`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...localeHeader(),
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`Profile update failed: ${response.status}`);
  return (await response.json()) as ProfileResponse;
}

export async function searchMemories(query: string): Promise<SearchResponse> {
  if (!query.trim()) throw new Error("Enter a search query.");

  const token = await getAccessToken();
  if (!token) throw new Error("Please sign in with Google.");
  const response = await fetch(`${API_BASE}/api/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...localeHeader(),
    },
    body: JSON.stringify({ query, limit: 12, include_related: true }),
  });
  if (!response.ok) throw new Error(`Search failed: ${response.status}`);
  return (await response.json()) as SearchResponse;
}

export async function runRecallPlayground(queries: string[]): Promise<PlaygroundResponse> {
  const token = await getAccessToken();
  if (!token) throw new Error("Please sign in with Google.");
  const response = await fetch(`${API_BASE}/api/search/playground`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...localeHeader(),
    },
    body: JSON.stringify({ queries, limit: 6, include_related: true }),
  });
  if (!response.ok) throw new Error(`Playground failed: ${response.status}`);
  return (await response.json()) as PlaygroundResponse;
}

export async function uploadMemory(file: File | null, text?: string) {
  const token = await getAccessToken();
  if (!token) throw new Error("Please sign in with Google before uploading.");

  const formData = new FormData();
  if (file) formData.append("file", file);
  if (text) formData.append("text", text);
  formData.append("source_type", file?.type.startsWith("image/") ? "screenshot" : file?.type === "application/pdf" ? "pdf" : "note");

  const response = await fetch(`${API_BASE}/api/ingestion/items`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      ...localeHeader(),
    },
    body: formData,
  });
  if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
  return response.json();
}

export async function archiveMemory(itemId: string) {
  const token = await getAccessToken();
  if (!token) throw new Error("Please sign in with Google.");

  const response = await fetch(`${API_BASE}/api/memories/${itemId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      ...localeHeader(),
    },
  });
  if (!response.ok) throw new Error(`Delete failed: ${response.status}`);
  return response.json();
}

export async function updateMemoryState(
  itemId: string,
  input: { is_favorite?: boolean; is_pinned?: boolean; archived?: boolean },
) {
  const token = await getAccessToken();
  if (!token) throw new Error("Please sign in with Google.");

  const response = await fetch(`${API_BASE}/api/memories/${itemId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...localeHeader(),
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`Update failed: ${response.status}`);
  return response.json();
}
