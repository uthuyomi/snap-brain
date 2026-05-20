from app.core.config import Settings
from app.schemas.search import QueryExpansion
from app.services.openai.client import create_openai_client
from app.services.openai.structured_outputs import parse_json_output, strict_json_schema


QUERY_EXPANSION_PROMPTS = {
    "ja": """SnapBrainの曖昧な記憶検索クエリを軽量に拡張してください。
目的は回答ではなく、スクリーンショット、写真、PDF、メモを思い出しやすくする検索語を増やすことです。

方針:
- terms は日本語、英語、固有名詞を混ぜてよい。
- 固有名詞、サービス名、プロダクト名、エラー名、UI用語は原文を残す。
- ユーザーが直接入力していない関連語も少しだけ追加する。
- 長い推論や会話文は不要。厳密なJSONだけを返す。""",
    "en": """Lightly expand an ambiguous SnapBrain memory search query.
The goal is not to answer the user. The goal is to add retrieval terms that help recall screenshots, photos, PDFs, and notes.

Rules:
- terms may mix English, Japanese, proper nouns, and UI/product words.
- Preserve proper nouns, service names, product names, error names, and UI terms as written.
- Add only a small number of useful related terms the user did not type.
- Do not produce a long explanation. Return strict JSON only.""",
}


class OpenAIQueryExpansionService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.client = create_openai_client(settings)

    def expand(self, query: str, locale: str = "ja") -> QueryExpansion:
        locale = normalize_locale(locale)
        fallback = self._fallback(query, locale)
        if not query.strip():
            return fallback

        try:
            response = self.client.responses.create(
                model=self.settings.openai_query_model,
                input=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "input_text", "text": QUERY_EXPANSION_PROMPTS[locale]},
                            {"type": "input_text", "text": query},
                        ],
                    }
                ],
                text={"format": strict_json_schema(QueryExpansion, name="query_expansion")},
            )
            expanded = parse_json_output(response.output_text, QueryExpansion)
            return self._merge_fallback(query=query, expanded=expanded, fallback=fallback)
        except Exception:
            return fallback

    def _fallback(self, query: str, locale: str) -> QueryExpansion:
        terms = [term for term in query.replace("　", " ").split(" ") if term]
        terms.extend(self._compound_hints(query))
        compact_terms = list(dict.fromkeys(terms + self._domain_hints(query)))
        return QueryExpansion(
            original_query=query,
            expanded_query=" ".join(compact_terms) or query,
            terms=compact_terms,
            entities=[term for term in compact_terms if any(ch.isupper() for ch in term)],
            intent_summary=(
                f"「{query}」に関連する記憶を探す"
                if locale == "ja"
                else f"Find memories related to '{query}'"
            ),
        )

    def _merge_fallback(
        self,
        *,
        query: str,
        expanded: QueryExpansion,
        fallback: QueryExpansion,
    ) -> QueryExpansion:
        terms = list(dict.fromkeys([query, *fallback.terms, *expanded.terms, *expanded.entities]))
        return QueryExpansion(
            original_query=query,
            expanded_query=expanded.expanded_query or " ".join(terms),
            terms=terms[:24],
            entities=expanded.entities[:12],
            intent_summary=expanded.intent_summary,
        )

    def _domain_hints(self, query: str) -> list[str]:
        hints: list[str] = []
        lower = query.lower()
        if "配送" in query or "配達" in query or "route" in lower:
            hints.extend(["RouteSnap", "LP", "広告", "UI", "delivery", "dispatch", "route optimization"])
        if "広告" in query or "LP" in query or "landing" in lower:
            hints.extend(["campaign", "creative", "landing page", "CTA", "hero", "copy"])
        if "エラー" in query or "error" in lower:
            hints.extend(["Stripe", "API", "exception", "failed", "payment_intent", "webhook"])
        if "青" in query or "blue" in lower:
            hints.extend(["blue", "dashboard", "UI", "chart", "analytics"])
        if "ui" in lower or "画面" in query or "デザイン" in query:
            hints.extend(["UI", "screenshot", "dashboard", "layout", "inspiration"])
        if "chatgpt" in lower or "gpt" in lower:
            hints.extend(["ChatGPT", "prompt", "conversation", "answer"])
        if "twitter" in lower or lower.strip() == "x" or "ツイート" in query:
            hints.extend(["Twitter", "X", "thread", "post", "tweet"])
        return hints

    def _compound_hints(self, query: str) -> list[str]:
        hints: list[str] = []
        if "配送LP" in query:
            hints.extend(["配送", "LP"])
        if "広告案" in query:
            hints.extend(["広告", "案", "creative"])
        if "Stripeエラー" in query:
            hints.extend(["Stripe", "エラー"])
        return hints


def normalize_locale(locale: str) -> str:
    return "ja" if locale == "ja" else "en"
