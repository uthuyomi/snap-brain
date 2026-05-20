import Link from "next/link";
import { ArrowLeft, BarChart3, SearchCheck } from "lucide-react";

import { getServerLocale } from "@/lib/i18n-server";
import { runRecallPlaygroundServer } from "@/lib/server-api";

export default async function RecallPlaygroundPage() {
  const locale = await getServerLocale();
  const queries =
    locale === "ja"
      ? ["前の配送LP", "Stripeエラー", "青いダッシュボード", "RouteSnap広告", "あのUIのやつ", "ChatGPTで相談した検索UX"]
      : ["previous delivery LP", "Stripe error", "blue dashboard", "RouteSnap ad", "that UI screenshot", "search UX discussed in ChatGPT"];
  const data = await runRecallPlaygroundServer(queries);

  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-6">
          <Link href="/" className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <p className="text-sm font-semibold text-slate-950">{locale === "ja" ? "想起ベンチマーク" : "Recall Benchmark"}</p>
            <p className="text-xs text-slate-500">{locale === "ja" ? "検索品質の調整盤" : "Internal search quality tuning"}</p>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-700">
            <BarChart3 className="h-4 w-4" />
            {locale === "ja" ? "想起シグナルの確認" : "Recall signal inspection"}
          </div>
          <p className="max-w-3xl text-sm leading-6 text-slate-600">
            {locale === "ja"
              ? "クエリ展開、類似度、ランキング補正、見つかった理由、関連候補をまとめて確認します。"
              : "Inspect query expansion, similarity, ranking boosts, why matched, and related memories."}
          </p>
        </div>

        <div className="space-y-5">
          {data.cases.map((item) => (
            <article key={item.query} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-950">{item.query}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {item.response.recall_summary ?? (locale === "ja" ? "想起サマリーはありません" : "No recall summary")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(item.response.expanded_terms ?? []).slice(0, 8).map((term) => (
                    <span key={term} className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">
                      {term}
                    </span>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <div className="grid min-w-[980px] grid-cols-[44px_minmax(220px,1.2fr)_110px_minmax(280px,1.2fr)_minmax(240px,1fr)] bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
                  <span>#</span>
                  <span>{locale === "ja" ? "記憶" : "Memory"}</span>
                  <span>{locale === "ja" ? "スコア" : "Score"}</span>
                  <span>{locale === "ja" ? "理由 / 補正" : "Why / Boosts"}</span>
                  <span>{locale === "ja" ? "関連候補" : "Related candidates"}</span>
                </div>
                {item.response.results.slice(0, 6).map((result, index) => (
                  <div
                    key={result.chunk_id}
                    className="grid min-w-[980px] grid-cols-[44px_minmax(220px,1.2fr)_110px_minmax(280px,1.2fr)_minmax(240px,1fr)] border-t border-slate-100 px-3 py-3 text-sm"
                  >
                    <span className="text-slate-400">{index + 1}</span>
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <SearchCheck className="h-4 w-4 text-blue-600" />
                        <p className="font-medium text-slate-900">{result.source_label ?? result.source_type}</p>
                      </div>
                      <p className="line-clamp-2 text-xs leading-5 text-slate-500">{result.short_summary ?? result.content}</p>
                      {result.personal_context?.length ? (
                        <p className="mt-2 text-[11px] text-blue-700">{result.personal_context.join(" / ")}</p>
                      ) : null}
                    </div>
                    <div className="text-slate-700">
                      <p className="font-semibold">{result.score.toFixed(3)}</p>
                      <p className="mt-1 text-xs text-slate-500">{result.source_type}</p>
                    </div>
                    <div>
                      <p className="mb-2 text-xs leading-5 text-slate-600">{result.why_matched}</p>
                      <div className="grid grid-cols-2 gap-1">
                        {Object.entries(result.ranking_signals ?? {}).map(([key, value]) => (
                          <span key={key} className="rounded bg-slate-50 px-2 py-1 text-[11px] text-slate-500">
                            {key}: {Number(value ?? 0).toFixed(3)}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1">
                      {(result.related ?? []).slice(0, 4).map((related) => (
                        <div key={related.item_id} className="rounded bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
                          <div className="font-medium text-slate-700">{related.source_label ?? related.source_type}</div>
                          <div>{related.relation_reason}</div>
                          <div className="text-slate-400">similarity: {related.similarity.toFixed(3)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
