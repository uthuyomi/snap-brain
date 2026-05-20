from app.core.config import Settings
from app.schemas.memory import InputModality, MemorySourceType
from app.schemas.openai import NormalizedMemory, VisionExtraction


class MemoryNormalizer:
    def __init__(self, settings: Settings):
        self.settings = settings

    def normalize(
        self,
        *,
        source_type: MemorySourceType,
        input_modality: InputModality,
        raw_text: str | None,
        extraction: VisionExtraction | None,
        source_label: str | None,
        locale: str = "ja",
    ) -> NormalizedMemory:
        locale = "ja" if locale == "ja" else "en"
        label = source_label or self._source_label(source_type, locale)

        if extraction:
            headings = self._headings(locale)
            retrieval_text = "\n".join(
                part
                for part in [
                    f"{headings['source']}: {label}",
                    f"{headings['visible_text']}: {extraction.visible_text}",
                    f"{headings['visual_context']}: {extraction.visual_summary}",
                    f"{headings['likely_context']}: {extraction.likely_context}",
                    f"{headings['tags']}: {', '.join(extraction.tags)}" if extraction.tags else "",
                ]
                if part.strip()
            )
            title = extraction.likely_context[:80] or label
            return NormalizedMemory(
                title=title,
                source_label=label,
                normalized_summary=extraction.likely_context or extraction.visual_summary or extraction.visible_text,
                retrieval_text=retrieval_text,
                why_this_may_matter=extraction.likely_context,
                tags=extraction.tags,
                thumbnail_metadata={"input_modality": input_modality.value},
                importance_score=extraction.confidence,
            )

        text = raw_text or ""
        return NormalizedMemory(
            title=text.strip().splitlines()[0][:80] if text.strip() else label,
            source_label=label,
            normalized_summary=text[:500],
            retrieval_text=f"{self._headings(locale)['source']}: {label}\n{text}",
            thumbnail_metadata={"input_modality": input_modality.value},
            importance_score=0.3,
        )

    def _source_label(self, source_type: MemorySourceType, locale: str) -> str:
        ja_labels = {
            MemorySourceType.screenshot: "スクリーンショット",
            MemorySourceType.photo: "写真",
            MemorySourceType.pdf: "PDF",
            MemorySourceType.note: "メモ",
            MemorySourceType.file: "ファイル",
            MemorySourceType.web: "Web",
            MemorySourceType.unknown: "記憶",
        }
        en_labels = {
            MemorySourceType.screenshot: "Screenshot",
            MemorySourceType.photo: "Photo",
            MemorySourceType.pdf: "PDF",
            MemorySourceType.note: "Note",
            MemorySourceType.file: "File",
            MemorySourceType.web: "Web",
            MemorySourceType.unknown: "Memory",
        }
        labels = ja_labels if locale == "ja" else en_labels
        return labels.get(source_type, "記憶" if locale == "ja" else "Memory")

    def _headings(self, locale: str) -> dict[str, str]:
        if locale == "ja":
            return {
                "source": "出典",
                "visible_text": "画像内テキスト",
                "visual_context": "視覚的な内容",
                "likely_context": "推定される文脈",
                "tags": "タグ",
            }
        return {
            "source": "Source",
            "visible_text": "Visible text",
            "visual_context": "Visual context",
            "likely_context": "Likely context",
            "tags": "Tags",
        }
