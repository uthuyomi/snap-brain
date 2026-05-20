import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMemoryDate(value?: string | null) {
  if (!value) return "時刻不明";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "時刻不明";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function sourceLabel(sourceType?: string) {
  switch (sourceType) {
    case "screenshot":
      return "Screenshot";
    case "photo":
      return "Photo";
    case "pdf":
      return "PDF";
    case "note":
      return "Note";
    default:
      return "Memory";
  }
}

