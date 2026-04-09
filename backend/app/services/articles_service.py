"""Articles service layer.

Encapsulates article-related business logic and keeps API routes thin.
"""

import logging
import re
import uuid
from datetime import datetime
from typing import Any, Optional

from fastapi import HTTPException

from backend.app.schemas.article import (
    ArticleCreate,
    ArticleListResponse,
    ArticleResponse,
    ArticleUpdate,
)
from backend.database.guard import SQLGuard
from backend.database.repository import ArticleRepository

logger = logging.getLogger(__name__)


def strip_html(text: str) -> str:
    """Remove HTML tags and return a compact plain-text summary."""
    if not text:
        return ""
    text = re.sub(r"<[^>]*>", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:200]


def format_date(dt: Any) -> Optional[str]:
    """Format datetime-like objects as YYYY-MM-DD."""
    if dt is None:
        return None
    if hasattr(dt, "strftime"):
        return dt.strftime("%Y-%m-%d")
    return str(dt)[:10]


def _to_article_response(record: dict[str, Any]) -> ArticleResponse:
    return ArticleResponse(
        id=record.get("news_id", ""),
        title=record.get("title", ""),
        url=record.get("url", ""),
        content=record.get("content_markdown", ""),
        summary=strip_html(record.get("content_text", "")) if record.get("content_text") else None,
        author=record.get("author", ""),
        published_date=format_date(record.get("publish_date")),
        tags=record.get("tags", []),
        source=record.get("source_site", ""),
        attachments=record.get("attachments", []),
        created_at=record.get("last_updated"),
        updated_at=record.get("last_updated"),
    )


def list_articles(
    *,
    table: Any,
    sql_guard: SQLGuard,
    page: int,
    page_size: int,
    source: Optional[str],
    tags: Optional[str],
    conn: Any = None,
) -> ArticleListResponse:
    offset = (page - 1) * page_size

    conditions: dict[str, Any] = {}
    if source:
        conditions["source_site"] = source
    if tags:
        conditions["tags"] = [tag.strip() for tag in tags.split(",")]

    where_clause = sql_guard.build_safe_where(conditions) if conditions else None

    has_tags_filter = bool(tags)
    can_use_order_table = not has_tags_filter and conn is not None

    if can_use_order_table:
        try:
            news_ids, total = conn.get_ordered_news_ids(offset, page_size, source)

            if news_ids:
                id_list = ", ".join(f"'{nid}'" for nid in news_ids)
                articles_results = table.search().where(f"news_id IN ({id_list})").to_list()

                articles_map = {r.get("news_id"): r for r in articles_results}
                paginated_results = [articles_map[nid] for nid in news_ids if nid in articles_map]
            else:
                paginated_results = []

            items = [_to_article_response(record) for record in paginated_results]
            total_pages = (total + page_size - 1) // page_size

            return ArticleListResponse(
                items=items,
                total=total,
                page=page,
                page_size=page_size,
                total_pages=total_pages,
            )
        except Exception as e:
            logger.warning(f"article_order pagination failed, falling back: {e}")

    if where_clause:
        results = table.search().where(where_clause).to_list()
        total = len(results)
    else:
        results = table.to_pandas().to_dict("records")
        total = len(results)

    def sort_key(item):
        pd = item.get("publish_date")
        if pd is None:
            return datetime.min
        if isinstance(pd, str):
            try:
                return datetime.fromisoformat(pd.replace("Z", "+00:00"))
            except:
                return datetime.min
        return pd

    results.sort(key=sort_key, reverse=True)

    paginated_results = results[offset : offset + page_size]

    items = [_to_article_response(record) for record in paginated_results]
    total_pages = (total + page_size - 1) // page_size

    return ArticleListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


def get_article(*, table: Any, sql_guard: SQLGuard, article_id: str) -> ArticleResponse:
    safe_where = sql_guard.build_safe_where({"news_id": article_id})
    results = table.search().where(safe_where).limit(1).to_list()
    if not results:
        raise HTTPException(status_code=404, detail="Article not found")
    return _to_article_response(results[0])


def create_article(*, repo: ArticleRepository, article: ArticleCreate) -> ArticleResponse:
    article_id = str(uuid.uuid4())
    now = datetime.now()

    data = {
        "news_id": article_id,
        "title": article.title,
        "url": article.url,
        "content_markdown": article.content or "",
        "content_text": article.content or "",
        "author": article.author or "",
        "source_site": article.source or "",
        "tags": article.tags,
        "publish_date": article.published_date,
        "last_updated": now,
        "title_embedding": [0.0] * 384,
        "content_embedding": [0.0] * 1024,
    }

    repo.add_one(data)

    return ArticleResponse(
        id=article_id,
        title=article.title,
        url=article.url,
        content=article.content,
        summary=article.summary,
        author=article.author,
        published_date=article.published_date,
        tags=article.tags,
        source=article.source,
        created_at=now,
        updated_at=now,
    )


def update_article(
    *, repo: ArticleRepository, article_id: str, article: ArticleUpdate
) -> ArticleResponse:
    existing = repo.get(article_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Article not found")

    update_data: dict[str, Any] = {}
    if article.title is not None:
        update_data["title"] = article.title
    if article.content is not None:
        update_data["content_markdown"] = article.content
        update_data["content_text"] = article.content
    if article.summary is not None:
        update_data["content_text"] = article.summary
    if article.tags is not None:
        update_data["tags"] = article.tags
    if article.source is not None:
        update_data["source_site"] = article.source

    if update_data:
        repo.update_one(article_id, update_data)

    updated = repo.get(article_id)

    return ArticleResponse(
        id=updated.news_id,
        title=updated.title,
        url=updated.url,
        content=updated.content_markdown,
        summary=updated.content_text[:200] if updated.content_text else None,
        author=updated.author,
        published_date=updated.publish_date,
        tags=updated.tags,
        source=updated.source_site,
        created_at=updated.last_updated,
        updated_at=updated.last_updated,
    )


def delete_article(*, repo: ArticleRepository, article_id: str) -> dict[str, str]:
    existing = repo.get(article_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Article not found")

    repo.delete_one(article_id)
    return {"message": "Article deleted successfully"}
