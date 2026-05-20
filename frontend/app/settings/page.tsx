import Link from "next/link";
import { ArrowLeft, Brain } from "lucide-react";

import { SettingsClient } from "./settings-client";
import { getServerLocale } from "@/lib/i18n-server";
import { messages } from "@/lib/i18n";

export default async function SettingsPage() {
  const locale = await getServerLocale();
  const t = messages[locale];

  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4 sm:px-6">
          <Link href="/" className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label={t.back}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-blue-600">
            <Brain className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-950">SnapBrain</p>
            <p className="text-xs text-slate-500">{t.settings}</p>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-950">{t.accountSettings}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{t.settingsBody}</p>
        </div>
        <SettingsClient initialLocale={locale} />
      </section>
    </main>
  );
}
