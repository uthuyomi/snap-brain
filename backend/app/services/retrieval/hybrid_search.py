from app.db.repositories.memory_chunks import MemoryChunksRepository
from app.schemas.search import RelatedMemoryCandidate, SearchRequest, SearchResponse, SearchResult
from app.services.openai.embeddings import OpenAIEmbeddingService
from app.services.openai.query_expansion import OpenAIQueryExpansionService


class HybridSearchService:
    def __init__(
        self,
        *,
        query_expansion: OpenAIQueryExpansionService,
        embeddings: OpenAIEmbeddingService,
        chunks: MemoryChunksRepository,
    ):
        self.query_expansion = query_expansion
        self.embeddings = embeddings
        self.chunks = chunks

    def search(self, *, user_id: str, request: SearchRequest, locale: str = "ja") -> SearchResponse:
        locale = "ja" if locale == "ja" else "en"
        expansion = self.query_expansion.expand(request.query, locale=locale) if request.use_query_expansion else None
        expanded_terms = expansion.terms if expansion else [request.query]
        expanded_entities = expansion.entities if expansion else []
        expanded_query = expansion.expanded_query if expansion else request.query
        query_embedding = self.embeddings.embed_texts([expanded_query])[0].vector
        rows = self.chunks.match(
            user_id=user_id,
            request=request,
            query_embedding=query_embedding,
            expanded_terms=expanded_terms,
            expanded_entities=expanded_entities,
        )

        results: list[SearchResult] = []
        for row in rows:
            metadata = row.get("metadata") or {}
            retrieval_metadata = metadata.get("retrieval") or {}
            ranking = metadata.get("ranking") or self._ranking_from_row(row)
            related = self._related_for_row(
                user_id=user_id,
                row=row,
                request=request,
                expanded_terms=expanded_terms,
                expanded_entities=expanded_entities,
                locale=locale,
            )
            results.append(
                SearchResult(
                    chunk_id=row["chunk_id"],
                    item_id=row["memory_item_id"],
                    score=row.get("final_score") or row.get("vector_similarity") or row.get("similarity") or 0,
                    source_type=row["source_type"],
                    chunk_type=row["chunk_type"],
                    source_label=row.get("source_label"),
                    content=row["content"],
                    short_summary=retrieval_metadata.get("short_ai_summary") or self._summary(row["content"]),
                    captured_at=row.get("captured_at"),
                    preview_path=row.get("preview_storage_path") or row.get("storage_path"),
                    thumbnail=metadata.get("thumbnail") or {},
                    why_matched=row.get("why_matched_summary")
                    or self._why_matched(request.query, row, expanded_terms, ranking, locale),
                    personal_context=self._personal_context(row, ranking, related, locale),
                    related=related,
                    ranking_signals=ranking,
                    debug=(metadata.get("debug") or {}) if request.include_debug else {},
                    metadata=metadata if request.include_debug else {},
                )
            )

        return SearchResponse(
            query=request.query,
            expanded_query=expanded_query,
            expanded_terms=expanded_terms,
            expanded_entities=expanded_entities,
            recall_summary=self._recall_summary(request.query, results, locale),
            results=results,
        )

    def _related_for_row(
        self,
        *,
        user_id: str,
        row: dict,
        request: SearchRequest,
        expanded_terms: list[str],
        expanded_entities: list[str],
        locale: str,
    ) -> list[RelatedMemoryCandidate]:
        if not request.include_related:
            return []

        related: list[RelatedMemoryCandidate] = []
        seen_item_ids = {row["memory_item_id"]}
        for candidate in self.chunks.related_candidates(
            user_id=user_id,
            chunk_id=row["chunk_id"],
            expanded_terms=expanded_terms,
            expanded_entities=expanded_entities,
            limit=12,
        ):
            candidate_item_id = candidate["memory_item_id"]
            if candidate_item_id in seen_item_ids:
                continue
            seen_item_ids.add(candidate_item_id)
            related.append(
                RelatedMemoryCandidate(
                    chunk_id=candidate["chunk_id"],
                    item_id=candidate_item_id,
                    source_label=candidate.get("source_label"),
                    source_type=candidate.get("source_type"),
                    preview_path=candidate.get("preview_storage_path"),
                    similarity=candidate["similarity"],
                    relation_reason=self._relation_reason(candidate.get("relation_reason"), candidate["similarity"], locale),
                    content_preview=self._preview(candidate.get("content") or ""),
                )
            )
            if len(related) >= 5:
                break
        return related

    def _ranking_from_row(self, row: dict) -> dict:
        keys = [
            "vector_similarity",
            "recency_boost",
            "exact_term_boost",
            "exact_entity_boost",
            "image_priority_boost",
            "ocr_confidence_boost",
            "repeated_topic_boost",
            "visual_context_boost",
            "personal_importance_boost",
            "favorite_boost",
            "pinned_boost",
            "interaction_boost",
            "topic_affinity_boost",
        ]
        return {key: row.get(key) for key in keys if row.get(key) is not None}

    def _why_matched(self, query: str, row: dict, expanded_terms: list[str], ranking: dict, locale: str) -> str:
        source_label = row.get("source_label") or row.get("source_type") or "memory"
        matched_terms = [term for term in expanded_terms if term and term.lower() in row["content"].lower()]
        if locale == "ja":
            reasons = [f"「{query}」に近い内容です"]
            if matched_terms:
                reasons.append("「" + "」「".join(matched_terms[:4]) + "」が含まれています")
            if (ranking.get("exact_entity_boost") or 0) > 0:
                reasons.append("関連する名前やサービスが一致しています")
            if (ranking.get("image_priority_boost") or 0) > 0:
                reasons.append("画像として保存された記憶です")
            if (ranking.get("visual_context_boost") or 0) > 0:
                reasons.append("見た目の文脈が近いです")
            if (ranking.get("topic_affinity_boost") or 0) > 0:
                reasons.append("最近よく扱っている話題に近いです")
            if (ranking.get("interaction_boost") or 0) > 0:
                reasons.append("最近見返している記憶です")
            if (ranking.get("favorite_boost") or 0) > 0:
                reasons.append("お気に入りに入っています")
            if (ranking.get("pinned_boost") or 0) > 0:
                reasons.append("ピン留めされています")
            if (ranking.get("recency_boost") or 0) > 0:
                reasons.append("最近保存されています")
            return f"{source_label}: " + " / ".join(reasons[:4])

        reasons = [f"close to '{query}'"]
        if matched_terms:
            reasons.append("contains " + ", ".join(matched_terms[:4]))
        if (ranking.get("exact_entity_boost") or 0) > 0:
            reasons.append("matching names or services")
        if (ranking.get("image_priority_boost") or 0) > 0:
            reasons.append("saved as an image memory")
        if (ranking.get("visual_context_boost") or 0) > 0:
            reasons.append("similar visual context")
        if (ranking.get("topic_affinity_boost") or 0) > 0:
            reasons.append("close to recent topics")
        if (ranking.get("interaction_boost") or 0) > 0:
            reasons.append("recently revisited")
        if (ranking.get("favorite_boost") or 0) > 0:
            reasons.append("favorited")
        if (ranking.get("pinned_boost") or 0) > 0:
            reasons.append("pinned")
        if (ranking.get("recency_boost") or 0) > 0:
            reasons.append("recently saved")
        return f"{source_label}: " + " / ".join(reasons[:4])

    def _personal_context(
        self,
        row: dict,
        ranking: dict,
        related: list[RelatedMemoryCandidate],
        locale: str,
    ) -> list[str]:
        metadata = row.get("metadata") or {}
        personal = metadata.get("personal") or {}
        open_count = int(personal.get("open_count") or 0)
        contexts: list[str] = []
        if locale == "ja":
            if (ranking.get("pinned_boost") or 0) > 0:
                contexts.append("ピン留めされています")
            if (ranking.get("favorite_boost") or 0) > 0:
                contexts.append("お気に入りの記憶です")
            if open_count >= 2:
                contexts.append(f"この記憶は{open_count}回開かれています")
            if (ranking.get("interaction_boost") or 0) > 0:
                contexts.append("最近よく見返している記憶です")
            if (ranking.get("topic_affinity_boost") or 0) > 0:
                contexts.append("最近扱っている話題に近いです")
            if related:
                contexts.append(f"関連する記憶が{len(related)}件あります")
            return contexts[:2]

        if (ranking.get("pinned_boost") or 0) > 0:
            contexts.append("Pinned memory")
        if (ranking.get("favorite_boost") or 0) > 0:
            contexts.append("Favorited memory")
        if open_count >= 2:
            contexts.append(f"Opened {open_count} times")
        if (ranking.get("interaction_boost") or 0) > 0:
            contexts.append("Recently revisited")
        if (ranking.get("topic_affinity_boost") or 0) > 0:
            contexts.append("Close to recent topics")
        if related:
            contexts.append(f"{len(related)} related memories")
        return contexts[:2]

    def _relation_reason(self, reason: str | None, similarity: float, locale: str) -> str:
        if locale == "ja":
            mapping = {
                "same recall path": "同じ検索の流れで開かれています",
                "saved around the same time": "同じ時期に保存されています",
                "shares memory tags": "同じ話題の記憶です",
                "same visual source type": "似た内容のスクリーンショットです",
                "nearby semantic memory": "内容が近い記憶です",
            }
            return mapping.get(reason or "", "内容が近い記憶です" if similarity >= 0.75 else "一緒に見つかりやすい記憶です")
        mapping = {
            "same recall path": "Opened in the same recall path",
            "saved around the same time": "Saved around the same time",
            "shares memory tags": "Shares the same topic",
            "same visual source type": "Similar visual memory",
            "nearby semantic memory": "Similar content",
        }
        return mapping.get(reason or "", "Similar content" if similarity >= 0.75 else "Often useful together")

    def _recall_summary(self, query: str, results: list[SearchResult], locale: str) -> str:
        if not results:
            return (
                f"「{query}」に近い記憶はまだ見つかりません。"
                if locale == "ja"
                else f"No close memories found for '{query}' yet."
            )
        top = results[0]
        count = len(results)
        related_count = sum(len(result.related) for result in results[:3])
        personal_count = sum(1 for result in results[:5] if result.personal_context)
        if locale == "ja":
            context = f"最近のあなたの流れに近い記憶も{personal_count}件含まれています。" if personal_count else ""
            return (
                f"「{query}」に近い記憶が{count}件見つかりました。"
                f"{top.source_label or top.source_type} が特に近そうです。"
                f"関連する記憶も{related_count}件つながっています。"
                f"{context}"
            )
        context = f"{personal_count} results also match your recent context. " if personal_count else ""
        return (
            f"Found {count} memories close to '{query}'. "
            f"{top.source_label or top.source_type} looks like the strongest match. "
            f"{related_count} related memories are also connected. "
            f"{context}"
        )

    def _summary(self, content: str) -> str:
        normalized = " ".join(content.split())
        return normalized[:220] + ("..." if len(normalized) > 220 else "")

    def _preview(self, content: str) -> str:
        normalized = " ".join(content.split())
        return normalized[:140] + ("..." if len(normalized) > 140 else "")
