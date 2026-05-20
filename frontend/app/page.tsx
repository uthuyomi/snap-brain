import Link from "next/link";
import { Brain, Menu, Plus, Search, UploadCloud } from "lucide-react";

import { AuthButton } from "@/components/memory/auth-button";
import { MemoryCard } from "@/components/memory/memory-card";
import { MemorySearchBar } from "@/components/memory/search-bar";
import { ReflectionPanel } from "@/components/memory/reflection-panel";
import { UploadModal } from "@/components/memory/upload-modal";
import { Button } from "@/components/ui/button";
import { messages } from "@/lib/i18n";
import { getServerLocale } from "@/lib/i18n-server";
import { toMemory } from "@/lib/memory-adapter";
import { groupHomeMemories } from "@/lib/memory-groups";
import { listHomeMemoryDataServer } from "@/lib/server-api";
import type { Memory } from "@/lib/types";

export default async function HomePage() {
  const locale = await getServerLocale();
  const t = messages[locale];
  const { items: rows, pattern } = await listHomeMemoryDataServer();
  const memories = rows.map((row) => toMemory(row, row.chunks ?? []));
  const groups = groupHomeMemories(memories);
  const fallbackSuggested =
    locale === "ja"
      ? ["赤いエラー画面", "前に見た配送LP", "青い管理画面", "ChatGPTの回答", "UI参考"]
      : ["red error screen", "previous delivery LP", "blue admin dashboard", "ChatGPT answer", "UI inspiration"];
  const suggested = pattern?.suggested_queries?.length ? pattern.suggested_queries.slice(0, 8) : fallbackSuggested;
  const frequentFromPattern = memoriesByIds(memories, pattern?.frequently_recalled_item_ids);
  const frequentlyRecalled = frequentFromPattern.length ? frequentFromPattern : groups.frequentlyRecalled;
  const forgotten = memoriesByIds(memories, pattern?.forgotten_candidate_item_ids).slice(0, 4);

  return (
    <main className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto grid max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-blue-600">
              <Brain className="h-4 w-4" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-slate-950">SnapBrain</p>
              <p className="text-xs text-slate-500">{t.memoryLayer}</p>
            </div>
          </div>
          <div className="mx-auto w-full max-w-2xl">
            <MemorySearchBar locale={locale} />
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <UploadModal locale={locale} />
            </div>
            <AuthButton />
            <Button variant="ghost" size="icon" className="sm:hidden" aria-label="Menu">
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-8">
          <section className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <h1 className="text-xl font-semibold text-slate-950 sm:text-2xl">
                {locale === "ja" ? "あとから見つかる保存箱" : "A capture box that stays findable"}
              </h1>
              <p className="mt-1 text-sm leading-6 text-slate-500">{t.recentSubtitle}</p>
            </div>
            <UploadModal locale={locale} />
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
              <Search className="h-4 w-4 text-blue-600" />
              {locale === "ja" ? "試しに探す" : "Suggested searches"}
            </div>
            <div className="flex flex-wrap gap-2">
              {suggested.map((query) => (
                <Link
                  key={query}
                  href={`/search?q=${encodeURIComponent(query)}`}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                >
                  {query}
                </Link>
              ))}
            </div>
          </section>

          {pattern?.recent_focus?.length || pattern?.top_topics?.length ? (
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-base font-semibold text-slate-950">
                {locale === "ja" ? "最近よく扱っていること" : "Recent focus"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {locale === "ja"
                  ? "最近の検索や見返した記憶から、探しやすい入口を作っています。"
                  : "Shortcuts based on what you have been searching and revisiting."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[...(pattern.recent_focus ?? []), ...(pattern.top_topics ?? [])].slice(0, 8).map((topic) => (
                  <Link key={topic} href={`/search?q=${encodeURIComponent(topic)}`} className="rounded-full bg-blue-50 px-3 py-1.5 text-sm text-blue-700">
                    {topic}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {!memories.length ? <EmptyState locale={locale} /> : null}
          <MemorySection title={locale === "ja" ? "ピン留め" : "Pinned"} memories={groups.pinned} locale={locale} />
          <MemorySection title={locale === "ja" ? "今日追加" : "Today"} memories={groups.today} locale={locale} />
          <MemorySection title={locale === "ja" ? "最近よく見た" : "Frequently recalled"} memories={frequentlyRecalled} locale={locale} />
          <MemorySection title={locale === "ja" ? "もう一度見てもよさそう" : "Worth revisiting"} memories={forgotten} locale={locale} compact />
          <MemorySection title={locale === "ja" ? "エラー画面" : "Error screens"} memories={groups.errors} locale={locale} compact />
          <MemorySection title={locale === "ja" ? "UI参考" : "UI inspiration"} memories={groups.ui} locale={locale} compact />
          <MemorySection title="PDF" memories={groups.pdfs} locale={locale} compact />
          <MemorySection title="ChatGPT" memories={groups.chatgpt} locale={locale} compact />
          <MemorySection title={t.recentMemories} memories={memories} locale={locale} />
        </div>

        <div className="hidden lg:block">
          <ReflectionPanel memories={memories} locale={locale} pattern={pattern} />
        </div>
      </section>

      <div className="fixed bottom-5 right-5 z-40">
        <UploadModal locale={locale} />
      </div>
      <div className="fixed bottom-20 right-5 z-30 hidden sm:block">
        <div className="pointer-events-none rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-600 opacity-0 shadow-soft transition-opacity">
          <Plus className="h-4 w-4" />
        </div>
      </div>
    </main>
  );
}

function MemorySection({
  title,
  memories,
  locale,
  compact = false,
}: {
  title: string;
  memories: Memory[];
  locale: "ja" | "en";
  compact?: boolean;
}) {
  if (!memories.length) return null;
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        <span className="text-xs text-slate-400">{memories.length}</span>
      </div>
      <div className={`grid gap-4 ${compact ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2 xl:grid-cols-3"}`}>
        {memories.slice(0, compact ? 4 : 9).map((memory) => (
          <MemoryCard key={`${title}-${memory.id}`} memory={memory} locale={locale} />
        ))}
      </div>
    </section>
  );
}

function EmptyState({ locale }: { locale: "ja" | "en" }) {
  const examples =
    locale === "ja"
      ? ["エラー画面", "ChatGPTの回答", "UI参考画像", "PDF", "X/Twitterの投稿", "ホワイトボード写真"]
      : ["error screens", "ChatGPT answers", "UI inspiration", "PDFs", "X/Twitter posts", "whiteboard photos"];
  return (
    <section className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white text-blue-600 shadow-sm">
          <UploadCloud className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            {locale === "ja" ? "まずはスクショを1枚入れてください" : "Start by adding one screenshot"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {locale === "ja"
              ? "保存しておくと、あとから自然な言葉で探せます。分類やフォルダ分けは不要です。"
              : "Once saved, you can find it later with natural language. No folders required."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {examples.map((example) => (
              <span key={example} className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600 ring-1 ring-slate-200">
                {example}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function memoriesByIds(memories: Memory[], ids: string[] | undefined) {
  if (!ids?.length) return [];
  const byId = new Map(memories.map((memory) => [memory.id, memory]));
  return ids.map((id) => byId.get(id)).filter((memory): memory is Memory => Boolean(memory));
}
