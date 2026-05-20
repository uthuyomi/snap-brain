import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.config import get_settings  # noqa: E402
from app.db.repositories.memory_chunks import MemoryChunksRepository  # noqa: E402
from app.db.supabase import get_supabase_client  # noqa: E402
from app.schemas.search import SearchRequest  # noqa: E402
from app.services.openai.embeddings import OpenAIEmbeddingService  # noqa: E402
from app.services.openai.query_expansion import OpenAIQueryExpansionService  # noqa: E402
from app.services.retrieval.hybrid_search import HybridSearchService  # noqa: E402


DEFAULT_QUERIES = [
    "前の配送LP",
    "Stripeエラー",
    "青いダッシュボード",
    "RouteSnap広告",
    "あのUIのやつ",
    "ChatGPTで相談した検索UX",
]


def main() -> None:
    parser = argparse.ArgumentParser(description="Run recall benchmark queries against real retrieval.")
    parser.add_argument("--user-id", required=True)
    parser.add_argument("--query", action="append", dest="queries")
    parser.add_argument("--limit", type=int, default=5)
    args = parser.parse_args()

    missing = [
        name
        for name in ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "OPENAI_API_KEY"]
        if not os.getenv(name)
    ]
    if missing:
        raise SystemExit("Missing required environment variables: " + ", ".join(missing))

    settings = get_settings()
    chunks = MemoryChunksRepository(get_supabase_client(settings))
    service = HybridSearchService(
        query_expansion=OpenAIQueryExpansionService(settings),
        embeddings=OpenAIEmbeddingService(settings),
        chunks=chunks,
    )

    for query in args.queries or DEFAULT_QUERIES:
        response = service.search(
            user_id=args.user_id,
            request=SearchRequest(query=query, limit=args.limit, include_related=True, include_debug=True),
        )
        print("\n==", query)
        print("expanded:", response.expanded_terms)
        print("summary:", response.recall_summary)
        for index, result in enumerate(response.results, start=1):
            print(
                f"{index}. {result.source_label} score={result.score:.3f} "
                f"type={result.source_type} why={result.why_matched}"
            )
            print("   ranking:", result.ranking_signals)


if __name__ == "__main__":
    main()
