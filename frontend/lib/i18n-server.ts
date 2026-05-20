import { cookies, headers } from "next/headers";

import { AI_LOCALE_KEY, LOCALE_COOKIE, normalizeLocale, type AppLocale } from "./i18n";

export async function getServerLocale(): Promise<AppLocale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  if (cookieLocale === "ja" || cookieLocale === "en") return cookieLocale;

  const headerStore = await headers();
  return normalizeLocale(headerStore.get("accept-language"));
}

export async function getServerAiLocale(): Promise<AppLocale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(AI_LOCALE_KEY)?.value;
  if (cookieLocale === "ja" || cookieLocale === "en") return cookieLocale;
  return getServerLocale();
}
