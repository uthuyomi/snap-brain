import hashlib

from app.core.config import Settings
from app.schemas.openai import EmbeddingResult
from app.services.openai.client import create_openai_client


class OpenAIEmbeddingService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.client = create_openai_client(settings)

    def embed_texts(self, texts: list[str]) -> list[EmbeddingResult]:
        if not texts:
            return []

        response = self.client.embeddings.create(
            model=self.settings.openai_embedding_model,
            input=texts,
            dimensions=self.settings.openai_embedding_dimensions,
        )

        results: list[EmbeddingResult] = []
        for text, item in zip(texts, response.data, strict=True):
            content_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
            results.append(
                EmbeddingResult(
                    model=self.settings.openai_embedding_model,
                    dimensions=len(item.embedding),
                    embedding_version=self.settings.embedding_version,
                    vector=item.embedding,
                    embedding_hash=content_hash,
                    usage=response.usage.model_dump(mode="json") if response.usage else {},
                )
            )
        return results

