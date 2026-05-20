import { FileText, ImageIcon, MessageSquareText } from "lucide-react";

import type { SourceType } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  sourceType: SourceType;
  tone?: "blue" | "slate" | "indigo" | "zinc";
  className?: string;
  imageUrl?: string;
};

const toneMap = {
  blue: "border-blue-100 bg-blue-50/60",
  slate: "border-slate-200 bg-slate-50",
  indigo: "border-indigo-100 bg-indigo-50/50",
  zinc: "border-zinc-200 bg-zinc-50"
};

export function MemoryThumbnail({ title, sourceType, tone = "zinc", className, imageUrl }: Props) {
  const Icon = sourceType === "pdf" ? FileText : sourceType === "note" ? MessageSquareText : ImageIcon;

  if (imageUrl && (sourceType === "screenshot" || sourceType === "photo")) {
    return (
      <div className={cn("memory-thumbnail relative overflow-hidden rounded-md border border-slate-200 bg-slate-50", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={title} className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/55 to-transparent p-3">
          <p className="line-clamp-2 text-sm font-semibold leading-5 text-white">{title}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("memory-thumbnail relative overflow-hidden rounded-md border", toneMap[tone], className)}>
      <div className="absolute left-0 right-0 top-0 h-8 border-b border-white/70 bg-white/70" />
      <div className="absolute left-3 top-3 flex gap-1">
        <span className="h-2 w-2 rounded-full bg-slate-300" />
        <span className="h-2 w-2 rounded-full bg-slate-300" />
        <span className="h-2 w-2 rounded-full bg-slate-300" />
      </div>
      <div className="flex h-full flex-col justify-between p-4 pt-12">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-medium text-slate-500">
            <Icon className="h-3.5 w-3.5" />
            {sourceType.toUpperCase()}
          </div>
          <div className="space-y-2">
            <div className="h-3 w-4/5 rounded bg-slate-300/70" />
            <div className="h-3 w-3/5 rounded bg-slate-200" />
            <div className="h-3 w-2/3 rounded bg-slate-200" />
          </div>
        </div>
        <p className="line-clamp-2 text-sm font-semibold leading-5 text-slate-800">{title}</p>
      </div>
    </div>
  );
}
