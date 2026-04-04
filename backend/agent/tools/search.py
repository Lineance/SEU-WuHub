"""Search tool wrapping RetrievalEngine."""

from typing import Any

from backend.retrieval.engine import RetrievalEngine

from .protocol import ToolResult


class SearchTool:
    name = "search_keyword"
    description = "Search relevant campus articles by query and filters."

    def __init__(self, engine: RetrievalEngine, default_limit: int = 5) -> None:
        self._engine = engine
        self._default_limit = default_limit

    async def run(self, **kwargs: Any) -> ToolResult:
        # Accept both 'query' and 'keyword' as the search parameter
        query = str(kwargs.get("query", "") or kwargs.get("keyword", "")).strip()
        if not query:
            return ToolResult(ok=False, content={}, error="query is required")

        limit = int(kwargs.get("limit", self._default_limit))
        category = kwargs.get("category")
        tags = kwargs.get("tags")
        if tags and isinstance(tags, str):
            tags = [item.strip() for item in tags.split(",") if item.strip()]

        result = self._engine.search(
            query=query,
            search_type="hybrid",
            limit=limit,
            source_site=category,
            tags=tags,
            start_date=kwargs.get("start_date"),
            end_date=kwargs.get("end_date"),
        )

        items = [
            {
                "id": row.get("news_id"),
                "title": row.get("title"),
                "url": row.get("url"),
                "summary": row.get("content_text", "")[:200],
                "category": row.get("source_site"),
                "score": row.get("_score", 0),
            }
            for row in result.get("results", [])
        ]

        return ToolResult(ok=True, content={"results": items, "total": len(items)})
