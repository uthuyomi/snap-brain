"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Clock, Sparkles } from "lucide-react";

import type { AppLocale } from "@/lib/i18n";
import { messages } from "@/lib/i18n";
import type { Memory } from "@/lib/types";
import { formatMemoryDate } from "@/lib/utils";
import { MemoryActions } from "./memory-actions";
import { MemoryThumbnail } from "./memory-thumbnail";

export function MemoryCard({ memory, locale = "ja" }: { memory: Memory; locale?: AppLocale }) {
  const t = messages[locale];

  return (
    <motion.article
      whileHover={{ y: -3, scale: 1.006 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="group rounded-lg border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-soft"
    >
      <div className="p-3">
        <Link href={`/memories/${memory.id}`} className="block">
          <MemoryThumbnail
            title={memory.title}
            sourceType={memory.sourceType}
            tone={memory.thumbnailTone}
            imageUrl={memory.previewUrl}
            className="aspect-[4/3] w-full"
          />
        </Link>
        <div className="px-1 pb-1 pt-4">
          <div className="mb-2 flex items-start justify-between gap-3">
            <Link href={`/memories/${memory.id}`} className="min-w-0 flex-1">
            <h3 className="line-clamp-1 text-sm font-semibold text-slate-950">{memory.title}</h3>
            </Link>
            <MemoryActions itemId={memory.id} isFavorite={memory.isFavorite} isPinned={memory.isPinned} compact />
          </div>
          <Link href={`/memories/${memory.id}`} className="block">
            <p className="line-clamp-2 min-h-10 text-sm leading-5 text-slate-600">{memory.shortSummary}</p>
          </Link>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {memory.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
                {tag}
              </span>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatMemoryDate(memory.capturedAt)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5">
              {memory.sourceType}
            </span>
            <span className="hidden items-center gap-1 opacity-0 transition-opacity group-hover:inline-flex group-hover:opacity-100">
              <Sparkles className="h-3.5 w-3.5" />
              {t.organized}
            </span>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
