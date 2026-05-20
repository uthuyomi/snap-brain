import { Archive, Clock3, Layers3, WandSparkles } from "lucide-react";

import type { AppLocale } from "@/lib/i18n";
import { messages } from "@/lib/i18n";
import type { Memory, MemoryPattern } from "@/lib/types";

export function ReflectionPanel({
  memories,
  pattern,
  locale = "ja",
}: {
  memories: Memory[];
  pattern?: MemoryPattern | null;
  locale?: AppLocale;
}) {
  const t = messages[locale];
  const topics = pattern?.recent_focus?.length
    ? pattern.recent_focus.slice(0, 3)
    : Array.from(new Set(memories.flatMap((memory) => memory.tags))).slice(0, 3);
  const frequentCount = pattern?.frequently_recalled_item_ids?.length || memories.filter((memory) => (memory.openCount ?? 0) > 0).length;

  return (
    <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-50 text-blue-600">
          <WandSparkles className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-950">{t.today}</h2>
          <p className="text-xs text-slate-500">{t.organizingLightly}</p>
        </div>
      </div>
      <div className="space-y-3 text-sm">
        <PanelRow icon={Clock3} label={t.addedToday} value={`${memories.slice(0, 2).length}${locale === "ja" ? "件" : ""}`} />
        <PanelRow icon={Archive} label={locale === "ja" ? "最近よく見た" : "Revisited"} value={String(frequentCount || "-")} />
        <PanelRow icon={Layers3} label={t.frequentTopics} value={topics.join(" / ") || "-"} />
      </div>
      <div className="mt-5 border-t border-slate-100 pt-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-normal text-slate-400">{t.relatedOldMemory}</p>
        <p className="text-sm leading-6 text-slate-600">{t.relatedOldMemoryBody}</p>
      </div>
    </aside>
  );
}

function PanelRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-2 text-slate-500">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <span className="max-w-32 truncate font-medium text-slate-800">{value}</span>
    </div>
  );
}
