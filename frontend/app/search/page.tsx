import Link from "next/link";
import { ArrowLeft, CalendarDays, ImageIcon, Info, Layers3, Link2 } from "lucide-react";

import { MemoryRecallLink } from "@/components/memory/memory-recall-link";
import { MemorySearchBar } from "@/components/memory/search-bar";
import { MemoryThumbnail } from "@/components/memory/memory-thumbnail";
import { getServerLocale } from "@/lib/i18n-server";
import { messages } from "@/lib/i18n";
import { searchMemoriesServer } from "@/lib/server-api";
import { formatMemoryDate } from "@/lib/utils";
import type { SourceType } from "@/lib/types";

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: Props) {
  const locale = await getServerLocale();
  const t = messages[locale];
  const { q } = await searchParams;
  const query = q || (locale === "ja" ? "前のRouteSnap広告案" : "previous RouteSnap ad idea");
  const response = await searchMemoriesServer(query);
  const top = response.results[0];

  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-6">
          <Link href="/" className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label={t.back}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <MemorySearchBar compact locale={locale} />
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-blue-700">
            <Layers3 className="h-4 w-4" />
            {t.searchRecall}
          </div>
          <h1 className="max-w-3xl text-xl font-semibold leading-8 text-slate-950">
            {top
              ? locale === "ja"
                ? `${response.results.length}件の記憶が見つかりました。${top.source_label ?? "最初の記憶"} が特に近そうです。`
                : `${response.results.length} memories found. ${top.source_label ?? "The first memory"} looks especially close.`
              : t.noCloseMemory}
          </h1>
          {response.recall_summary ? <p className="mt-2 text-sm leading-6 text-slate-600">{response.recall_summary}</p> : null}
        </div>

        <div className="space-y-3">
          {response.results.map((result, index) => (
            <MemoryRecallLink
              href={`/memories/${result.item_id}`}
              key={result.chunk_id}
              source="search"
              searchQuery={query}
              className="block rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-soft"
            >
              <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
                <MemoryThumbnail
                  title={result.source_label ?? result.source_type}
                  sourceType={result.source_type as SourceType}
                  tone={index === 0 ? "blue" : "zinc"}
                  imageUrl={result.preview_url}
                  className="aspect-[16/10]"
                />
                <div className="min-w-0 py-1">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-base font-semibold text-slate-950">
                        {result.source_label ?? result.source_type}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatMemoryDate(result.captured_at)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <ImageIcon className="h-3.5 w-3.5" />
                          {result.source_type}
                        </span>
                        {result.related?.length ? (
                          <span className="inline-flex items-center gap-1">
                            <Link2 className="h-3.5 w-3.5" />
                            {locale === "ja" ? `関連 ${result.related.length}件` : `${result.related.length} related`}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <p className="line-clamp-2 text-sm leading-6 text-slate-600">{result.short_summary ?? result.content}</p>
                  <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm leading-5 text-slate-600">
                    <span className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                      <Info className="h-3.5 w-3.5" />
                      {t.whyFound}
                    </span>
                    <p>{result.why_matched}</p>
                    {result.personal_context?.length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {result.personal_context.slice(0, 2).map((context) => (
                          <span key={context} className="rounded-full bg-white px-2 py-1 text-[11px] text-slate-500 ring-1 ring-slate-200">
                            {context}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {result.related?.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {result.related.slice(0, 4).map((related) => (
                        <span key={related.item_id} className="rounded-full border border-slate-200 px-2 py-1 text-[11px] text-slate-500">
                          {related.relation_reason ?? related.source_label ?? "related"}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </MemoryRecallLink>
          ))}
        </div>
      </section>
    </main>
  );
}
