"""
Articles API - REST endpoints for article listing and details (READ-ONLY)

Responsibilities:
    - GET /api/v1/articles with source filtering
    - GET /api/v1/articles/{id} detail view
    - Pagination with cursor-based navigation
"""

from typing import Any

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from app.core.constants import (
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    MSG_ARTICLE_NOT_FOUND,
    MSG_LOAD_FAILED,
    MSG_LOAD_SUCCESS,
)
from app.data.repository import ArticleRepository
from app.data.schema import ArticleFields

router = APIRouter()

# Initialize repository
_repo: ArticleRepository | None = None


def get_repo() -> ArticleRepository:
    """Get or create the article repository instance."""
    global _repo
    if _repo is None:
        _repo = ArticleRepository()
    return _repo


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
        "metadata": article.get(ArticleFields.METADATA),
    }


@router.get("/articles")
async def list_articles(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE, description="Items per page"),
    source: str | None = Query(None, description="Filter by source site"),
) -> JSONResponse:
    """
    List articles with pagination and optional source filtering.

    - **page**: Page number (starts from 1)
    - **page_size**: Number of items per page
    - **source**: Optional source site filter (e.g., "教务处")
    """
    try:
        repo = get_repo()
        offset = (page - 1) * page_size

        if source:
            articles_list = repo.find_by_source(source, limit=page_size)
            # Apply offset manually for filtered results
            articles_list = articles_list[offset : offset + page_size]
        else:
            articles_list = repo.find_all(limit=page_size, offset=offset)

        total = repo.count()

        return JSONResponse(
            content={
                "success": True,
                "message": MSG_LOAD_SUCCESS,
                "data": [article_to_response(a) for a in articles_list],
                "pagination": {
                    "page": page,
                    "page_size": page_size,
                    "total": total,
                    "total_pages": (total + page_size - 1) // page_size,
                },
            }
        )
    except Exception as e:
        return JSONResponse(
            content={"success": False, "message": f"{MSG_LOAD_FAILED}: {str(e)}", "data": []},
            status_code=500,
        )


@router.get("/articles/{article_id}")
async def get_article(article_id: str) -> JSONResponse:
    """
    Get article detail by ID.

    - **article_id**: The unique article identifier (news_id)
    """
    try:
        repo = get_repo()
        article = repo.get(article_id)

        if not article:
            return JSONResponse(
                content={"success": False, "message": MSG_ARTICLE_NOT_FOUND, "data": None},
                status_code=404,
            )

        return JSONResponse(
            content={
                "success": True,
                "message": MSG_LOAD_SUCCESS,
                "data": article_to_response(article),
            }
        )
    except Exception as e:
        return JSONResponse(
            content={"success": False, "message": f"{MSG_LOAD_FAILED}: {str(e)}", "data": None},
            status_code=500,
        )


@router.get("/categories")
async def list_categories() -> JSONResponse:
    """List all available categories (derived from source sites)."""
    try:
        repo = get_repo()
        source_counts = repo.count_by_source()

        categories = [
            {"id": source, "name": source, "count": count}
            for source, count in source_counts.items()
        ]

        # Sort by count descending
        categories.sort(key=lambda x: x["count"], reverse=True)

        return JSONResponse(
            content={
                "success": True,
                "message": MSG_LOAD_SUCCESS,
                "data": categories,
            }
        )
    except Exception as e:
        return JSONResponse(
            content={"success": False, "message": f"{MSG_LOAD_FAILED}: {str(e)}", "data": []},
            status_code=500,
        )
