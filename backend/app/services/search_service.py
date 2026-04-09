"""Search service layer.

Encapsulates search business logic and response mapping.
"""

import re
from typing import Any, Optional

from backend.app.schemas.search import SearchResponse, SearchResult
from backend.retrieval.engine import RetrievalEngine


def strip_html(text: str) -> str:
    """Remove HTML tags and return a compact plain-text summary."""
    if not text:
        return ""
    text = re.sub(r"<[^>]*>", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:200]


def format_date(dt: Any) -> str:
    """Format datetime-like objects as YYYY-MM-DD."""
    if dt is None:
        return ""
    if hasattr(dt, "strftime"):
        return dt.strftime("%Y-%m-%d")
    return str(dt)[:10]


def _to_search_response(query: str, raw_result: dict[str, Any]) -> SearchResponse:
    search_results = []
    for item in raw_result.get("results", []):
        search_results.append(
            SearchResult(
                id=item["news_id"],
                title=item["title"],
                url=item["url"],
                summary=strip_html(item.get("content_text", ""))
                if item.get("content_text")
                else None,
                score=item.get("_score", 0.9),
                source=item.get("source_site", ""),
                tags=item.get("tags", []),
                published_date=format_date(item.get("publish_date")),
            )
        )

    return SearchResponse(query=query, results=search_results, total=len(search_results))


def search_articles(
    *,
    engine: RetrievalEngine,
    query: str,
    limit: int,
    offset: int = 0,
    source: Optional[str],
    tags: Optional[list[str]],
    start_date: Optional[str],
    end_date: Optional[str],
) -> SearchResponse:
    raw_result = engine.search(
        query=query,
        search_type="hybrid",
        limit=limit,
        offset=offset,
        source_site=source,
        tags=tags,
        keyword_weight=0.7,
        vector_weight=0.3,
        start_date=start_date,
        end_date=end_date,
    )
    return SearchResponse(
    query=query,
    results=search_results,
    total=raw_result.get("total", len(search_results)),
)