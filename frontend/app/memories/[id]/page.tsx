import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, CheckCircle2, FileSearch, Tags } from "lucide-react";

import { DeleteMemoryButton } from "@/components/memory/delete-memory-button";
import { MemoryActions } from "@/components/memory/memory-actions";
import { MemoryRecallLink } from "@/components/memory/memory-recall-link";
import { MemoryThumbnail } from "@/components/memory/memory-thumbnail";
import { MemoryVisitMarker } from "@/components/memory/memory-visit-marker";
import { OriginalPreview } from "@/components/memory/original-preview";
import { getServerLocale } from "@/lib/i18n-server";
import { messages } from "@/lib/i18n";
import { toMemory } from "@/lib/memory-adapter";
import { getMemoryServer } from "@/lib/server-api";
import { formatMemoryDate } from "@/lib/utils";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function MemoryDetailPage({ params }: Props) {
  const locale = await getServerLocale();
  const t = messages[locale];
  const { id } = await params;
  const data = await getMemoryServer(id);
  if (!data) notFound();
  const memory = toMemory(data.item, data.chunks);
  const related = (data.related ?? []).map((row) => toMemory(row, row.chunks ?? []));

  return (
    <main className="min-h-screen bg-white">
      <MemoryVisitMarker itemId={memory.id} />
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-6">
          <Link href="/" className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label={t.back}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-950">{memory.title}</p>
            <p className="text-xs text-slate-500">{memory.sourceLabel}</p>
          </div>
          <MemoryActions itemId={memory.id} isFavorite={memory.isFavorite} isPinned={memory.isPinned} />
          <DeleteMemoryButton itemId={memory.id} title={memory.title} locale={locale} />
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <OriginalPreview title={memory.title} sourceType={memory.sourceType} tone={memory.thumbnailTone} imageUrl={memory.originalUrl} />
        </div>

        <aside className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h1 className="text-lg font-semibold text-slate-950">{memory.title}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">{memory.aiSummary ?? memory.shortSummary}</p>
            <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
              <Calendar className="h-4 w-4" />
              {formatMemoryDate(memory.capturedAt)}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950">
              <FileSearch className="h-4 w-4 text-blue-600" />
              {t.readableText}
            </div>
            <pre className="max-h-44 overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-600 scrollbar-calm">
              {memory.ocrText || "-"}
            </pre>
          </section>

          {memory.todos?.length ? (
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950">
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                {t.extractedTodos}
              </div>
              <div className="space-y-2">
                {memory.todos.map((todo) => (
                  <p key={todo} className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    {todo}
                  </p>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950">
              <Tags className="h-4 w-4 text-blue-600" />
              {t.relatedContext}
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {memory.entities?.length
                ? memory.entities.map((entity) => (
                    <span key={entity} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700">
                      {entity}
                    </span>
                  ))
                : null}
            </div>
            <div className="space-y-2">
              {related.map((item) => (
                <MemoryRecallLink
                  key={item.id}
                  href={`/memories/${item.id}`}
                  source="related"
                  className="block rounded-md border border-slate-200 p-3 hover:bg-slate-50"
                >
                  <div className="grid grid-cols-[74px_1fr] gap-3">
                    <MemoryThumbnail
                      title={item.title}
                      sourceType={item.sourceType}
                      tone={item.thumbnailTone}
                      imageUrl={item.previewUrl}
                      className="aspect-[4/3]"
                    />
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-sm font-medium text-slate-800">{item.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.relationReason ?? item.shortSummary}</p>
                    </div>
                  </div>
                </MemoryRecallLink>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
