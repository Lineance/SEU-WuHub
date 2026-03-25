"""
Search API - Hybrid retrieval endpoint (READ-ONLY)

Responsibilities:
    - GET /api/v1/search?q= query parameter handling
    - Hybrid search service orchestration
    - Result formatting and scoring metadata
"""

from typing import Any

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from app.core.constants import DEFAULT_PAGE_SIZE, MSG_SEARCH_FAILED, MSG_SEARCH_SUCCESS
from data.repository import ArticleRepository
from data.schema import ArticleFields

router = APIRouter()


def get_repo() -> ArticleRepository:
    """Get or create the article repository instance."""
    return ArticleRepository()


def article_to_response(article: dict[str, Any]) -> dict[str, Any]:
    """Convert article record to API response format."""
    publish_date = article.get(ArticleFields.PUBLISH_DATE)
    last_updated = article.get(ArticleFields.LAST_UPDATED)

    return {
        "id": article.get(ArticleFields.NEWS_ID, ""),
        "title": article.get(ArticleFields.TITLE, ""),
        "summary": (
            article.get(ArticleFields.CONTENT_TEXT, "")[:200]
            if article.get(ArticleFields.CONTENT_TEXT)
            else ""
        ),
        "content": article.get(ArticleFields.CONTENT_MARKDOWN, ""),
        "content_text": article.get(ArticleFields.CONTENT_TEXT, ""),
        "source": article.get(ArticleFields.SOURCE_SITE, ""),
        "author": article.get(ArticleFields.AUTHOR, ""),
        "source_url": article.get(ArticleFields.URL, ""),
        "published_at": publish_date.isoformat() if publish_date else None,
        "updated_at": last_updated.isoformat() if last_updated else None,
        "tags": article.get(ArticleFields.TAGS, []),
    }


@router.get("/search")
async def search_articles(
    q: str = Query(..., min_length=1, description="Search query"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=100, description="Items per page"),
) -> JSONResponse:
    """
    Search articles using full-text search.

    - **q**: Search query string
    - **page**: Page number (starts from 1)
    - **page_size**: Number of items per page
    """
    try:
        repo = get_repo()
        offset = (page - 1) * page_size

        # Perform full-text search
        results = repo.search_text(q, limit=page_size * page)  # Get more for pagination

        # Apply pagination
        paginated_results = results[offset : offset + page_size]

        return JSONResponse(
            content={
                "success": True,
                "message": MSG_SEARCH_SUCCESS,
                "data": [article_to_response(a) for a in paginated_results],
                "pagination": {
                    "page": page,
                    "page_size": page_size,
                    "total": len(results),
                    "total_pages": (len(results) + page_size - 1) // page_size,
                },
                "query": q,
            }
        )
    except Exception as e:
        return JSONResponse(
            content={
                "success": False,
                "message": f"{MSG_SEARCH_FAILED}: {str(e)}",
                "data": [],
            },
            status_code=500,
        )
