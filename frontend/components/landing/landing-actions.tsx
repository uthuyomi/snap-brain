"use client";

import Link from "next/link";
import { ArrowRight, Languages } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { AppLocale } from "@/lib/i18n";
import { setClientLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";

export function LandingStartButton({ locale, children }: { locale: AppLocale; children: React.ReactNode }) {
  async function start() {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      window.location.href = "/";
      return;
    }
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <Button onClick={start} className="h-12 rounded-lg bg-slate-950 px-7 text-white hover:bg-slate-800">
      {children}
      <ArrowRight className="h-4 w-4" />
    </Button>
  );
}

export function LandingLoginLink({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={async () => {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          window.location.href = "/";
          return;
        }
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/auth/callback` },
        });
      }}
      className="text-sm font-medium text-slate-700 transition-colors hover:text-slate-950"
    >
      {children}
    </button>
  );
}

export function LandingLocaleToggle({ locale }: { locale: AppLocale }) {
  const router = useRouter();
  const nextLocale = locale === "ja" ? "en" : "ja";
  return (
    <button
      type="button"
      onClick={() => {
        setClientLocale(nextLocale);
        router.refresh();
      }}
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm backdrop-blur transition-colors hover:bg-white hover:text-slate-950"
    >
      <Languages className="h-3.5 w-3.5" />
      {locale === "ja" ? "English" : "日本語"}
    </button>
  );
}

export function DemoLink({ locale }: { locale: AppLocale }) {
  return (
    <Link href="/search?q=Stripe%20error" className="inline-flex h-12 items-center gap-2 rounded-lg px-4 text-sm font-medium text-slate-800 hover:bg-slate-100">
      {locale === "ja" ? "デモを見る" : "View demo"}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}
