export type AppLocale = "ja" | "en";
export type LocalePreference = "auto" | AppLocale;

export const LOCALE_COOKIE = "snapbrain-locale";
export const AI_LOCALE_KEY = "snapbrain-ai-locale";

export const messages = {
  ja: {
    memoryLayer: "memory layer",
    recentMemories: "最近の記憶",
    recentSubtitle: "スクショ、PDF、メモを雑に置いて、あとから自然に思い出せます。",
    items: "件",
    emptyTitle: "まだ記憶がありません",
    emptyBody: "Googleでログインして、スクショ、PDF、メモをアップロードするとここに並びます。",
    upload: "アップロード",
    searchAction: "思い出す",
    searchRequired: "検索したい言葉を入力してください",
    loginRequired: "Googleでログインしてください",
    uploadRequired: "画像、PDF、またはメモを追加してください",
    uploadSuccess: "保存しました。AIが整理しています。",
    uploadFailed: "アップロードに失敗しました。バックエンド設定を確認してください。",
    save: "保存",
    cancel: "キャンセル",
    dropHere: "ここにドロップ",
    dropAccepts: "画像とPDFに対応しています",
    quickNote: "短いメモ",
    organizeTitle: "雑に保存",
    organizeBody: "スクショ、写真、PDF、短いメモをそのまま置けます。",
    organizing: "整理しています...",
    image: "画像",
    memo: "メモ",
    searchRecall: "記憶の想起",
    noCloseMemory: "近い記憶はまだ見つかりません。",
    whyFound: "なぜ見つかったか",
    back: "戻る",
    readableText: "読み取ったテキスト",
    extractedTodos: "抽出されたTODO",
    relatedContext: "関連する文脈",
    organized: "整理済み",
    delete: "削除",
    deleteDone: "記憶を削除しました",
    deleteFailed: "削除に失敗しました",
    deleteConfirmTitle: "この記憶を削除しますか？",
    deleteConfirmBody: "一覧と検索結果から非表示にします。元ファイルの完全削除はまだ行いません。",
    settings: "設定",
    accountSettings: "アカウント設定",
    language: "表示言語",
    aiLanguage: "AIが生成する文章の言語",
    autoLanguage: "自動",
    japanese: "日本語",
    english: "English",
    saveSettings: "設定を保存",
    settingsSaved: "設定を保存しました",
    settingsBody: "日本語ユーザーは自動で日本語、それ以外は英語になります。必要なら手動で固定できます。",
    today: "今日",
    organizingLightly: "裏側で軽く整理中",
    addedToday: "今日追加",
    unorganized: "未整理",
    frequentTopics: "よく出る話題",
    relatedOldMemory: "関連しそうな記憶",
    relatedOldMemoryBody: "検索すると、近い時期や似た話題の記憶も一緒に拾います。",
  },
  en: {
    memoryLayer: "memory layer",
    recentMemories: "Recent Memories",
    recentSubtitle: "A quiet shelf for rough captures you can recall later.",
    items: "items",
    emptyTitle: "No memories yet",
    emptyBody: "Sign in with Google, then upload screenshots, PDFs, or notes.",
    upload: "Upload",
    searchAction: "Recall",
    searchRequired: "Enter a search query.",
    loginRequired: "Please sign in with Google.",
    uploadRequired: "Add an image, PDF, or note.",
    uploadSuccess: "Saved. AI is organizing it.",
    uploadFailed: "Upload failed. Check the backend settings.",
    save: "Save",
    cancel: "Cancel",
    dropHere: "Drop it here",
    dropAccepts: "Images and PDFs are supported",
    quickNote: "Quick note",
    organizeTitle: "Save without sorting",
    organizeBody: "Drop screenshots, photos, PDFs, or short notes as-is.",
    organizing: "AI is organizing...",
    image: "Image",
    memo: "Memo",
    searchRecall: "Memory recall",
    noCloseMemory: "No close memories found yet.",
    whyFound: "Why this appeared",
    back: "Back",
    readableText: "Extracted text",
    extractedTodos: "Extracted TODOs",
    relatedContext: "Related context",
    organized: "Organized",
    delete: "Delete",
    deleteDone: "Memory deleted",
    deleteFailed: "Delete failed",
    deleteConfirmTitle: "Delete this memory?",
    deleteConfirmBody: "This hides it from lists and search results. Permanent file deletion is not performed yet.",
    settings: "Settings",
    accountSettings: "Account Settings",
    language: "Display language",
    aiLanguage: "AI-generated text language",
    autoLanguage: "Auto",
    japanese: "Japanese",
    english: "English",
    saveSettings: "Save settings",
    settingsSaved: "Settings saved",
    settingsBody: "Japanese users default to Japanese; everyone else defaults to English. You can pin either language.",
    today: "Today",
    organizingLightly: "Lightly organized in the background",
    addedToday: "Added today",
    unorganized: "Unorganized",
    frequentTopics: "Frequent topics",
    relatedOldMemory: "Related old memory",
    relatedOldMemoryBody: "Search also pulls nearby memories by time and topic.",
  },
} as const;

export function normalizeLocale(value: string | null | undefined): AppLocale {
  return value?.toLowerCase().startsWith("ja") ? "ja" : "en";
}

export function getClientLocale(): AppLocale {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(LOCALE_COOKIE);
  if (stored === "ja" || stored === "en") return stored;
  return normalizeLocale(window.navigator.language);
}

export function getClientAiLocale(): AppLocale {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(AI_LOCALE_KEY);
  if (stored === "ja" || stored === "en") return stored;
  return getClientLocale();
}

export function setClientLocale(locale: AppLocale) {
  window.localStorage.setItem(LOCALE_COOKIE, locale);
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

export function setClientAiLocale(locale: AppLocale) {
  window.localStorage.setItem(AI_LOCALE_KEY, locale);
  document.cookie = `${AI_LOCALE_KEY}=${locale}; path=/; max-age=31536000; samesite=lax`;
}
