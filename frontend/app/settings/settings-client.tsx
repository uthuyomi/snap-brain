"use client";

import { Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getProfile, updateProfile } from "@/lib/api";
import type { AppLocale, LocalePreference } from "@/lib/i18n";
import { messages, setClientAiLocale, setClientLocale } from "@/lib/i18n";

const choices: LocalePreference[] = ["auto", "ja", "en"];

export function SettingsClient({ initialLocale }: { initialLocale: AppLocale }) {
  const [uiLocale, setUiLocale] = useState<AppLocale>(initialLocale);
  const [locale, setLocale] = useState<LocalePreference>("auto");
  const [aiLanguage, setAiLanguage] = useState<LocalePreference>("auto");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const t = messages[uiLocale];

  useEffect(() => {
    let mounted = true;
    getProfile()
      .then((profile) => {
        if (!mounted) return;
        setLocale(profile.locale);
        setAiLanguage(profile.preferred_ai_language);
        setUiLocale(profile.resolved_locale);
        setClientLocale(profile.resolved_locale);
        setClientAiLocale(resolvePreference(profile.preferred_ai_language, profile.resolved_locale));
      })
      .catch(() => {
        if (mounted) setClientLocale(initialLocale);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [initialLocale]);

  async function save() {
    setSaving(true);
    try {
      const profile = await updateProfile({ locale, preferred_ai_language: aiLanguage });
      setUiLocale(profile.resolved_locale);
      setClientLocale(profile.resolved_locale);
      setClientAiLocale(resolvePreference(profile.preferred_ai_language, profile.resolved_locale));
      toast.success(messages[profile.resolved_locale].settingsSaved);
      window.location.reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading...
        </div>
      ) : (
        <div className="space-y-6">
          <LanguageField label={t.language} value={locale} onChange={setLocale} uiLocale={uiLocale} />
          <LanguageField label={t.aiLanguage} value={aiLanguage} onChange={setAiLanguage} uiLocale={uiLocale} />
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t.saveSettings}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function resolvePreference(preference: LocalePreference, fallback: AppLocale): AppLocale {
  return preference === "ja" || preference === "en" ? preference : fallback;
}

function LanguageField({
  label,
  value,
  onChange,
  uiLocale,
}: {
  label: string;
  value: LocalePreference;
  onChange: (value: LocalePreference) => void;
  uiLocale: AppLocale;
}) {
  const t = messages[uiLocale];
  const labels = {
    auto: t.autoLanguage,
    ja: t.japanese,
    en: t.english,
  };

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-slate-800">{label}</p>
      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
        {choices.map((choice) => (
          <button
            key={choice}
            type="button"
            onClick={() => onChange(choice)}
            className={`rounded-md px-3 py-2 text-sm transition-colors ${
              value === choice ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {labels[choice]}
          </button>
        ))}
      </div>
    </div>
  );
}
