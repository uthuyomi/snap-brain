import type { Memory } from "./types";

export function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

export function groupHomeMemories(memories: Memory[]) {
  const today = startOfToday();
  const week = daysAgo(7);
  return {
    pinned: memories.filter((memory) => memory.isPinned),
    today: memories.filter((memory) => new Date(memory.capturedAt || 0) >= today),
    week: memories.filter((memory) => new Date(memory.capturedAt || 0) >= week),
    frequentlyRecalled: memories
      .filter((memory) => (memory.openCount ?? 0) + (memory.searchHitCount ?? 0) > 0)
      .sort((a, b) => (b.openCount ?? 0) + (b.searchHitCount ?? 0) - ((a.openCount ?? 0) + (a.searchHitCount ?? 0)))
      .slice(0, 6),
    errors: memories.filter((memory) => text(memory).includes("error") || text(memory).includes("エラー")),
    ui: memories.filter((memory) => text(memory).includes("ui") || text(memory).includes("dashboard") || text(memory).includes("画面")),
    pdfs: memories.filter((memory) => memory.sourceType === "pdf"),
    chatgpt: memories.filter((memory) => text(memory).includes("chatgpt") || text(memory).includes("gpt")),
    failed: memories.filter((memory) => memory.status === "failed"),
  };
}

function text(memory: Memory) {
  return `${memory.title} ${memory.shortSummary} ${memory.tags.join(" ")}`.toLowerCase();
}
