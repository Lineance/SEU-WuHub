"""
Articles API Router

提供文章相关的 API 接口。
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from backend.data.repository import ArticleRepository
from backend.retrieval.store import LanceStore
from backend.retrieval.engine import RetrievalEngine

from ...schemas.article import ArticleResponse, ArticleListResponse, ArticleCreate, ArticleUpdate
from ...schemas.search import SearchRequest, SearchResponse, SearchResult

router = APIRouter(prefix="/articles", tags=["articles"])

# 初始化组件
_repo: Optional[ArticleRepository] = None
_store: Optional[LanceStore] = None
_engine: Optional[RetrievalEngine] = None


def get_repo() -> ArticleRepository:
    global _repo
    if _repo is None:
        _repo = ArticleRepository()
    return _repo


def get_store() -> LanceStore:
    global _store
    if _store is None:
        _store = LanceStore()
    return _store


def get_engine() -> RetrievalEngine:
    global _engine
    if _engine is None:
        _engine = RetrievalEngine()
    return _engine


@router.get("/", response_model=ArticleListResponse)
async def list_articles(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    category: Optional[str] = None,
    tags: Optional[str] = None,
):
    """
    获取文章列表

    - **page**: 页码
    - **page_size**: 每页数量
    - **category**: 分类筛选
    - **tags**: 标签筛选（逗号分隔）
    """
    repo = get_repo()

    offset = (page - 1) * page_size

    # 构建查询条件
    where_parts = []
    if category:
        where_parts.append(f"source_site = '{category}'")
    if tags:
        tag_list = tags.split(",")
        tags_str = ", ".join(f"'{tag.strip()}'" for tag in tag_list)
        where_parts.append(f"tags IN ({tags_str})")

    where_clause = " AND ".join(where_parts) if where_parts else None

    # 执行查询
    try:
        if where_clause:
            results = repo.find(where=where_clause, limit=page_size, offset=offset)
        else:
            results = repo.find(limit=page_size, offset=offset)

        total = repo.count()

        items = [
            ArticleResponse(
                id=r.news_id,
                title=r.title,
                url=r.url,
                content=r.content_markdown,
                summary=r.content_text[:200] if r.content_text else None,
                author=r.author,
                published_date=r.publish_date,
                tags=r.tags,
                category=r.source_site,
                created_at=r.last_updated,
                updated_at=r.last_updated,
            )
            for r in results
        ]

        total_pages = (total + page_size - 1) // page_size

        return ArticleListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{article_id}", response_model=ArticleResponse)
async def get_article(article_id: str):
    """
    获取单个文章详情

    - **article_id**: 文章唯一标识
    """
    repo = get_repo()

    try:
        result = repo.get_by_id(article_id)
        if not result:
            raise HTTPException(status_code=404, detail="Article not found")

        return ArticleResponse(
            id=result.news_id,
            title=result.title,
            url=result.url,
            content=result.content_markdown,
            summary=result.content_text[:200] if result.content_text else None,
            author=result.author,
            published_date=result.publish_date,
            tags=result.tags,
            category=result.source_site,
            created_at=result.last_updated,
            updated_at=result.last_updated,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/", response_model=ArticleResponse)
async def create_article(article: ArticleCreate):
    """
    创建新文章

    - **article**: 文章数据
    """
    repo = get_repo()

    try:
        import uuid
        from datetime import datetime

        article_id = str(uuid.uuid4())
        now = datetime.now()

        data = {
            "news_id": article_id,
            "title": article.title,
            "url": article.url,
            "content_markdown": article.content or "",
            "content_text": article.content or "",
            "author": article.author or "",
            "source_site": article.category or "",
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
            category=article.category,
            created_at=now,
            updated_at=now,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{article_id}", response_model=ArticleResponse)
async def update_article(article_id: str, article: ArticleUpdate):
    """
    更新文章

    - **article_id**: 文章唯一标识
    - **article**: 更新后的文章数据
    """
    repo = get_repo()

    try:
        existing = repo.get_by_id(article_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Article not found")

        update_data = {}
        if article.title is not None:
            update_data["title"] = article.title
        if article.content is not None:
            update_data["content_markdown"] = article.content
            update_data["content_text"] = article.content
        if article.summary is not None:
            update_data["content_text"] = article.summary
        if article.tags is not None:
            update_data["tags"] = article.tags
        if article.category is not None:
            update_data["source_site"] = article.category

        if update_data:
            repo.update_one(article_id, update_data)

        updated = repo.get_by_id(article_id)

        return ArticleResponse(
            id=updated.news_id,
            title=updated.title,
            url=updated.url,
            content=updated.content_markdown,
            summary=updated.content_text[:200] if updated.content_text else None,
            author=updated.author,
            published_date=updated.publish_date,
            tags=updated.tags,
            category=updated.source_site,
            created_at=updated.last_updated,
            updated_at=updated.last_updated,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{article_id}")
async def delete_article(article_id: str):
    """
    删除文章

    - **article_id**: 文章唯一标识
    """
    repo = get_repo()

    try:
        existing = repo.get_by_id(article_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Article not found")

        repo.delete_one(article_id)

        return {"message": "Article deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
