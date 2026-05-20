"use client";

import { Command } from "cmdk";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

import type { AppLocale } from "@/lib/i18n";
import { messages } from "@/lib/i18n";

const placeholders = {
  ja: ["前のRouteSnap広告案", "Stripeで詰まってた時のエラー", "あの配送UIのスクショ"],
  en: ["previous RouteSnap ad idea", "the Stripe error from before", "that delivery UI screenshot"],
};

export function MemorySearchBar({ compact = false, locale = "ja" }: { compact?: boolean; locale?: AppLocale }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const t = messages[locale];
  const placeholder = useMemo(
    () => placeholders[locale][Math.floor(Date.now() / 5000) % placeholders[locale].length],
    [locale],
  );

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const value = query.trim() || placeholder;
    router.push(`/search?q=${encodeURIComponent(value)}`);
  }

  return (
    <Command className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <form onSubmit={submit} className="flex h-12 items-center gap-3 px-4">
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder={placeholder}
          className="h-full min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
        />
        {!compact && (
          <button type="submit" className="rounded-md bg-slate-950 px-3 py-1.5 text-xs font-medium text-white">
            {t.searchAction}
          </button>
        )}
      </form>
    </Command>
  );
}
