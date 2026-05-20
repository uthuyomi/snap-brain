import {
  Brain,
  Camera,
  Check,
  Clock3,
  FileText,
  ImageIcon,
  Link2,
  Lock,
  MessageSquareText,
  MousePointer2,
  ReceiptText,
  Search,
  Shield,
  Sparkles,
} from "lucide-react";

import { DemoLink, LandingLocaleToggle, LandingLoginLink, LandingStartButton } from "@/components/landing/landing-actions";
import { getServerLocale } from "@/lib/i18n-server";

const copy = {
  ja: {
    nav: { features: "できること", how: "仕組み", scenes: "保存例", login: "ログイン", start: "無料で始める" },
    hero: {
      title: "あの画像、\nどこだっけ？\nを終わらせる。",
      body: "スクショ、PDF、ChatGPT。\n雑に保存して、あとから自然に探せる。",
      footnote: "整理しなくても、見つかる場所。",
      query: "あのStripeエラー",
    },
    results: [
      {
        title: "Stripe payment failed",
        summary: "ChatGPTで見た決済APIエラー",
        meta: "2時間前",
        context: "12回開いた",
        why: "Stripe / payment / error が一致",
        img: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=640&q=84",
      },
      {
        title: "青い管理ダッシュボードUI",
        summary: "管理画面参考として保存",
        meta: "昨日",
        context: "関連する記憶 8件",
        why: "似た内容のスクリーンショット",
        img: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=640&q=84",
      },
      {
        title: "RouteSnap LP 修正メモ",
        summary: "配送LPの改善案",
        meta: "先週",
        context: "最近よく見返しています",
        why: "最近扱った話題",
        img: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=640&q=84",
      },
    ],
    chips: ["最近見た", "関連する記憶", "同じ時期", "よく一緒に見返される"],
    canDo: {
      title: "何ができるのか。",
      body: "ファイル名や保存場所を覚えていなくても、見た内容から探せます。",
      bullets: [
        "スクショの中身を検索",
        "PDFを自然な言葉で探せる",
        "ChatGPTの過去画面を見つける",
        "関連する情報をまとめて表示",
        "最近使った情報を優先表示",
      ],
    },
    compare: {
      title: "整理しなくていい。",
      before: "今まで",
      after: "SnapBrain",
      beforeItems: ["フォルダ分け", "タグ整理", "名前変更", "あとで整理"],
      afterMain: "とりあえず保存するだけ。",
      afterBody: "中身を読み取り、あとから探せる状態にします。",
    },
    fragments: {
      title: "記憶は、きれいに並んでいない。",
      body: "レシート、UI参考、PDF、旅行写真、メモ。日々の保存物を、そのまま受け止めます。",
      items: [
        ["レシート", "https://images.unsplash.com/photo-1554224154-26032ffc0d07?auto=format&fit=crop&w=520&q=84", "lg:col-span-2 lg:row-span-2", "aspect-[4/5]", "rotate-[-1.5deg]"],
        ["ChatGPT", "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=620&q=84", "lg:col-span-3", "aspect-[16/9]", "lg:mt-12 rotate-[0.8deg]"],
        ["PDF", "https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=520&q=84", "", "aspect-[3/4]", "lg:-mt-6 rotate-[1.6deg]"],
        ["Amazon", "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=520&q=84", "", "aspect-square", "rotate-[-0.8deg]"],
        ["旅行", "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=520&q=84", "lg:col-span-2", "aspect-[4/3]", "lg:translate-y-10 rotate-[1.2deg]"],
        ["UI参考", "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=620&q=84", "lg:col-span-2", "aspect-[5/4]", "lg:-translate-y-8 rotate-[-1deg]"],
        ["メモ", "https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=520&q=84", "", "aspect-[3/4]", "rotate-[1.5deg]"],
        ["レシピ", "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=520&q=84", "lg:col-span-2", "aspect-[16/10]", "lg:mt-8 rotate-[-0.6deg]"],
      ],
    },
    graph: {
      title: "なぜ、曖昧な言葉で見つかるのか。",
      body: "見えている文字、画面の内容、保存した時期、よく一緒に開く記憶。SnapBrainはそれらを静かにつなげます。",
      center: "Stripe Error",
      nodes: ["Dashboard UI", "ChatGPT", "Billing Memo", "RouteSnap", "Payment API"],
    },
    cta: {
      title: "保存した情報が、\nちゃんと見つかる場所へ。",
      body: "もう、「どこにいったっけ？」に時間を使わない。",
    },
    trust: [
      ["非公開で保存", "アップロードした情報は、自分だけがアクセスできます。"],
      ["整理は不要", "フォルダ管理や細かいタグ付けを前提にしていません。"],
      ["自然に探せる", "“あの画像” のような曖昧な言葉で探せます。"],
    ],
    footer: { tagline: "AI memory recall tool.", privacy: "プライバシー", terms: "利用規約", company: "運営会社", contact: "お問い合わせ" },
  },
  en: {
    nav: { features: "What it does", how: "How it works", scenes: "Saved things", login: "Log in", start: "Start free" },
    hero: {
      title: "End the\nwhere was\nthat image loop.",
      body: "Screenshots, PDFs, ChatGPT.\nSave roughly. Find it naturally later.",
      footnote: "Findable, even when unsorted.",
      query: "that Stripe error",
    },
    results: [
      {
        title: "Stripe payment failed",
        summary: "Payment API error from ChatGPT",
        meta: "2h ago",
        context: "opened 12 times",
        why: "Stripe / payment / error matched",
        img: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=640&q=84",
      },
      {
        title: "Blue admin dashboard UI",
        summary: "Saved as dashboard reference",
        meta: "Yesterday",
        context: "8 related memories",
        why: "similar screenshot",
        img: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=640&q=84",
      },
      {
        title: "RouteSnap LP edit note",
        summary: "Delivery LP improvement notes",
        meta: "Last week",
        context: "recently revisited",
        why: "recent topic",
        img: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=640&q=84",
      },
    ],
    chips: ["recently viewed", "related memories", "same time period", "often opened together"],
    canDo: {
      title: "What it does.",
      body: "Find information by what you saw, even when you forgot the file name or folder.",
      bullets: [
        "Search inside screenshots",
        "Find PDFs with natural language",
        "Recover old ChatGPT screens",
        "Show related information together",
        "Prioritize recently used memories",
      ],
    },
    compare: {
      title: "No need to organize first.",
      before: "Before",
      after: "SnapBrain",
      beforeItems: ["Folders", "Manual tags", "Rename files", "Sort later"],
      afterMain: "Just save it for now.",
      afterBody: "SnapBrain reads what is inside and keeps it findable later.",
    },
    fragments: {
      title: "Memory is not neatly arranged.",
      body: "Receipts, UI references, PDFs, travel photos, notes. SnapBrain accepts everyday captures as they are.",
      items: [
        ["Receipt", "https://images.unsplash.com/photo-1554224154-26032ffc0d07?auto=format&fit=crop&w=520&q=84", "lg:col-span-2 lg:row-span-2", "aspect-[4/5]", "rotate-[-1.5deg]"],
        ["ChatGPT", "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=620&q=84", "lg:col-span-3", "aspect-[16/9]", "lg:mt-12 rotate-[0.8deg]"],
        ["PDF", "https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=520&q=84", "", "aspect-[3/4]", "lg:-mt-6 rotate-[1.6deg]"],
        ["Amazon", "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=520&q=84", "", "aspect-square", "rotate-[-0.8deg]"],
        ["Travel", "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=520&q=84", "lg:col-span-2", "aspect-[4/3]", "lg:translate-y-10 rotate-[1.2deg]"],
        ["UI reference", "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=620&q=84", "lg:col-span-2", "aspect-[5/4]", "lg:-translate-y-8 rotate-[-1deg]"],
        ["Memo", "https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=520&q=84", "", "aspect-[3/4]", "rotate-[1.5deg]"],
        ["Recipe", "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=520&q=84", "lg:col-span-2", "aspect-[16/10]", "lg:mt-8 rotate-[-0.6deg]"],
      ],
    },
    graph: {
      title: "Why vague searches still work.",
      body: "Visible text, screen content, saved time, and memories you often open together. SnapBrain quietly connects them.",
      center: "Stripe Error",
      nodes: ["Dashboard UI", "ChatGPT", "Billing Memo", "RouteSnap", "Payment API"],
    },
    cta: {
      title: "Put your information\nsomewhere findable.",
      body: "Stop spending time asking, where did that go?",
    },
    trust: [
      ["Private by default", "Your uploads are only accessible to you."],
      ["No sorting required", "Folders and precise tags are not the starting point."],
      ["Search naturally later", "Find things with phrases like that image."],
    ],
    footer: { tagline: "AI memory recall tool.", privacy: "Privacy", terms: "Terms", company: "Company", contact: "Contact" },
  },
} as const;

const trustIcons = [Lock, Shield, Search];

export default async function LandingPage() {
  const locale = await getServerLocale();
  const t = copy[locale];

  return (
    <main className="min-h-screen overflow-hidden bg-white text-slate-950">
      <header className="fixed left-0 right-0 top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
          <a href="#top" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center border border-slate-900/15 bg-white text-slate-950 shadow-sm">
              <Brain className="h-5 w-5" />
            </div>
            <span className="text-xl font-black tracking-normal">SnapBrain</span>
          </a>
          <nav className="hidden items-center gap-9 text-sm font-medium text-slate-700 md:flex">
            <a href="#features" className="hover:text-slate-950">{t.nav.features}</a>
            <a href="#how" className="hover:text-slate-950">{t.nav.how}</a>
            <a href="#scenes" className="hover:text-slate-950">{t.nav.scenes}</a>
            <LandingLoginLink>{t.nav.login}</LandingLoginLink>
            <LandingLocaleToggle locale={locale} />
            <LandingStartButton locale={locale}>{t.nav.start}</LandingStartButton>
          </nav>
          <div className="flex items-center gap-2 md:hidden">
            <LandingLocaleToggle locale={locale} />
          </div>
        </div>
      </header>

      <section id="top" className="relative min-h-screen bg-[#fbfcff] pt-24">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(180deg,rgba(15,23,42,0.025)_1px,transparent_1px)] bg-[size:96px_96px]" />
        <div className="relative mx-auto grid min-h-[calc(100vh-96px)] max-w-[1280px] items-center gap-16 px-5 py-20 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-12">
          <div className="animate-lp-fade-up max-w-[680px]">
            <h1 className="whitespace-pre-line text-[4.6rem] font-black leading-[0.86] tracking-[-0.05em] text-slate-950 sm:text-[6.4rem] lg:text-[7.8rem]">
              {t.hero.title}
            </h1>
            <p className="mt-10 whitespace-pre-line text-lg font-light leading-8 text-slate-600 sm:text-xl">{t.hero.body}</p>
            <div className="mt-12 flex flex-wrap items-center gap-4">
              <LandingStartButton locale={locale}>{t.nav.start}</LandingStartButton>
              <DemoLink locale={locale} />
            </div>
            <p className="mt-12 text-xs font-light uppercase tracking-[0.18em] text-slate-400">{t.hero.footnote}</p>
          </div>
          <HeroMemorySpace t={t} />
        </div>
      </section>

      <section id="features" className="bg-white">
        <div className="mx-auto grid max-w-[1280px] gap-20 px-5 py-44 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:px-12">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">What it does</p>
            <h2 className="mt-7 max-w-xl text-5xl font-black leading-[0.96] tracking-[-0.04em] text-slate-950 sm:text-7xl">{t.canDo.title}</h2>
            <p className="mt-8 max-w-md text-base font-light leading-8 text-slate-600">{t.canDo.body}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {t.canDo.bullets.map((item, index) => (
              <div key={item} className={`border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-soft ${index === 1 || index === 4 ? "sm:translate-y-6" : ""}`}>
                <Check className="mb-10 h-4 w-4 text-[#2f3f73]" />
                <p className="text-lg font-black leading-tight text-slate-950">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f5f7fb]">
        <div className="mx-auto max-w-[1280px] px-5 py-52 sm:px-8 lg:px-12">
          <h2 className="max-w-2xl text-5xl font-black leading-[0.98] tracking-[-0.04em] text-slate-950 sm:text-7xl">{t.compare.title}</h2>
          <div className="mt-20 grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="border border-slate-200 bg-white/70 p-6 sm:p-8">
              <p className="text-sm font-black text-slate-500">{t.compare.before}</p>
              <div className="mt-8 grid gap-2">
                {t.compare.beforeItems.map((item, index) => (
                  <div key={item} className={`border border-slate-200 bg-white px-4 py-3 text-sm font-light text-slate-500 ${index % 2 ? "ml-8" : "mr-5"}`}>
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="border border-slate-200 bg-white p-10 sm:p-14">
              <p className="text-sm font-black text-[#2f3f73]">{t.compare.after}</p>
              <p className="mt-16 max-w-xl text-5xl font-black leading-[0.98] tracking-[-0.04em] text-slate-950 sm:text-7xl">{t.compare.afterMain}</p>
              <p className="mt-10 max-w-md text-base font-light leading-8 text-slate-600">{t.compare.afterBody}</p>
            </div>
          </div>
        </div>
      </section>

      <section id="scenes" className="bg-white">
        <div className="mx-auto max-w-[1280px] px-5 py-52 sm:px-8 lg:px-12">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Fragments</p>
              <h2 className="mt-7 text-5xl font-black leading-[0.98] tracking-[-0.04em] text-slate-950 sm:text-7xl">{t.fragments.title}</h2>
              <p className="mt-8 max-w-md text-base font-light leading-8 text-slate-600">{t.fragments.body}</p>
            </div>
            <FragmentWall items={t.fragments.items} />
          </div>
        </div>
      </section>

      <section id="how" className="bg-[#f8f7fb]">
        <div className="mx-auto grid max-w-[1280px] gap-20 px-5 py-52 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-12">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">How it finds things</p>
            <h2 className="mt-7 text-5xl font-black leading-[0.98] tracking-[-0.04em] text-slate-950 sm:text-7xl">{t.graph.title}</h2>
            <p className="mt-8 max-w-lg text-base font-light leading-8 text-slate-600">{t.graph.body}</p>
          </div>
          <MemoryGraph t={t} />
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-[1280px] gap-12 px-5 py-48 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:px-12">
          <div>
            <h2 className="whitespace-pre-line text-5xl font-black leading-[0.98] tracking-[-0.04em] text-slate-950 sm:text-7xl">{t.cta.title}</h2>
            <p className="mt-8 max-w-md text-base font-light leading-8 text-slate-600">{t.cta.body}</p>
            <div className="mt-10">
              <LandingStartButton locale={locale}>{t.nav.start}</LandingStartButton>
            </div>
          </div>
          <img
            src="https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1500&q=88"
            alt=""
            className="aspect-[16/10] w-full object-cover shadow-sm"
          />
        </div>
      </section>

      <section className="bg-[#fbfcff]">
        <div className="mx-auto grid max-w-[1280px] gap-8 border-y border-slate-200 px-5 py-12 sm:grid-cols-3 sm:px-8 lg:px-12">
          {t.trust.map(([title, body], index) => {
            const Icon = trustIcons[index];
            return (
              <div key={title} className="text-sm font-light leading-7 text-slate-600">
                <div className="mb-4 flex items-center gap-3 font-black text-slate-950">
                  <Icon className="h-4 w-4" />
                  {title}
                </div>
                <p>{body}</p>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-5 py-9 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
          <div className="flex items-center gap-3">
            <Brain className="h-7 w-7" />
            <div>
              <p className="font-black text-slate-950">SnapBrain</p>
              <p className="text-xs font-light text-slate-500">{t.footer.tagline}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-8 text-sm font-light text-slate-600">
            <a href="#" className="hover:text-slate-950">{t.footer.privacy}</a>
            <a href="#" className="hover:text-slate-950">{t.footer.terms}</a>
            <a href="#" className="hover:text-slate-950">{t.footer.company}</a>
            <a href="#" className="hover:text-slate-950">{t.footer.contact}</a>
          </div>
        </div>
      </footer>
    </main>
  );
}

function HeroMemorySpace({ t }: { t: (typeof copy)["ja"] | (typeof copy)["en"] }) {
  return (
    <div className="animate-lp-fade-up-delay relative min-h-[620px]">
      <div className="absolute right-0 top-8 h-[520px] w-[82%] border border-slate-200 bg-white/75 shadow-[0_30px_90px_rgba(15,23,42,0.08)]" />
      <div className="absolute left-2 top-0 w-[78%] border border-slate-200 bg-white p-4 shadow-[0_24px_80px_rgba(15,23,42,0.1)]">
        <div className="flex h-14 items-center gap-3 border border-slate-200 bg-[#f7f9fc] px-4">
          <Search className="h-5 w-5 text-slate-500" />
          <span className="animate-lp-type text-sm font-medium text-slate-950">{t.hero.query}</span>
          <Sparkles className="ml-auto h-4 w-4 text-[#2f3f73]" />
        </div>
        <div className="mt-5 space-y-3">
          {t.results.map((result, index) => (
            <div key={result.title} className={`animate-lp-result border border-slate-200 bg-white p-3 shadow-sm [animation-delay:${300 + index * 220}ms] ${index === 1 ? "ml-8" : index === 2 ? "mr-10" : ""}`}>
              <div className="grid grid-cols-[88px_1fr] gap-3">
                <img src={result.img} alt="" className={`${index === 1 ? "h-24" : "h-20"} w-full object-cover`} />
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-1 text-sm font-black text-slate-950">{result.title}</h3>
                    <span className="shrink-0 text-[11px] font-light text-slate-400">{result.meta}</span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs font-light text-slate-500">{result.summary}</p>
                  <p className="mt-3 text-[11px] font-medium text-[#2f3f73]">{result.context}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-12 right-3 w-[44%] border border-slate-200 bg-[#f8f7fb] p-5 shadow-[0_20px_70px_rgba(15,23,42,0.08)]">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Recent focus</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {t.chips.map((chip, index) => (
            <span key={chip} className={`border border-slate-200 bg-white px-2.5 py-1 text-xs font-light text-slate-600 ${index === 1 ? "text-[#2f3f73]" : ""}`}>
              {chip}
            </span>
          ))}
        </div>
      </div>

      <div className="absolute bottom-4 left-12 w-[36%] border border-slate-200 bg-white p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
        <div className="mb-3 flex items-center gap-2 text-xs font-medium text-slate-500">
          <Clock3 className="h-3.5 w-3.5" />
          Memory trail
        </div>
        <div className="space-y-2">
          {["Stripe Error", "ChatGPT", "Payment API"].map((item, index) => (
            <div key={item} className="flex items-center gap-2 text-xs font-light text-slate-600">
              <span className={`h-2 w-2 rounded-full ${index === 0 ? "bg-[#2f3f73]" : "bg-slate-300"}`} />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FragmentWall({ items }: { items: readonly (readonly [string, string, string, string, string])[] }) {
  return (
    <div className="grid auto-rows-[90px] grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
      {items.map(([label, src, span, ratio, transform], index) => (
        <div key={label} className={`${span} ${transform} group relative transition duration-300 hover:z-10 hover:-translate-y-2`}>
          <img src={src} alt="" className={`${ratio} h-full w-full border border-slate-200 object-cover shadow-sm transition duration-300 group-hover:scale-[1.02] group-hover:shadow-[0_20px_60px_rgba(15,23,42,0.16)]`} />
          <div className={`absolute ${index % 2 ? "right-3 top-3" : "bottom-3 left-3"} bg-white/90 px-2 py-1 text-xs font-light text-slate-700 shadow-sm`}>
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}

function MemoryGraph({ t }: { t: (typeof copy)["ja"] | (typeof copy)["en"] }) {
  const positions = [
    "left-[4%] top-[18%]",
    "right-[8%] top-[16%]",
    "left-[10%] bottom-[18%]",
    "right-[5%] bottom-[20%]",
    "left-1/2 top-[6%] -translate-x-1/2",
  ];
  return (
    <div className="relative min-h-[560px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.07)]">
      <div className="absolute inset-12 border border-slate-100" />
      <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
        <div className="animate-lp-pulse border border-[#2f3f73]/30 bg-[#f7f9ff] px-8 py-6 text-center shadow-[0_20px_70px_rgba(47,63,115,0.14)]">
          <p className="text-xs font-light uppercase tracking-[0.18em] text-[#2f3f73]">center</p>
          <p className="mt-2 text-2xl font-black text-slate-950">{t.graph.center}</p>
        </div>
      </div>
      <div className="absolute left-1/2 top-1/2 h-px w-[78%] -translate-x-1/2 bg-[#2f3f73]/15" />
      <div className="absolute left-1/2 top-1/2 h-[70%] w-px -translate-y-1/2 bg-[#2f3f73]/15" />
      <div className="absolute left-[18%] top-[24%] h-px w-[60%] rotate-[28deg] bg-[#2f3f73]/10" />
      <div className="absolute left-[18%] bottom-[24%] h-px w-[62%] rotate-[-27deg] bg-[#2f3f73]/10" />
      {t.graph.nodes.map((node, index) => (
        <div key={node} className={`absolute ${positions[index]} border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-1 hover:border-[#2f3f73]/30 hover:text-[#2f3f73]`}>
          {node}
        </div>
      ))}
      <div className="absolute bottom-6 left-6 flex items-center gap-2 text-xs font-light text-slate-500">
        <MousePointer2 className="h-3.5 w-3.5" />
        related memories surface quietly
      </div>
    </div>
  );
}
