"""
Articles API Router

提供文章相关的 API 接口。
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import re

import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from backend.database.guard import SQLGuard
from backend.database.repository import ArticleRepository
from backend.retrieval.store import LanceStore
from backend.retrieval.engine import RetrievalEngine

from ...schemas.article import ArticleResponse, ArticleListResponse, ArticleCreate, ArticleUpdate
from ...schemas.search import SearchRequest, SearchResponse, SearchResult

# SQL 安全验证器
_sql_guard = SQLGuard()

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


def get_table():
    """直接获取 LanceDB 表"""
    import sys
    from pathlib import Path
    # 获取项目根目录 (backend 的父目录的父目录)
    # articles.py -> api/v1 -> app -> backend -> 项目根
    project_root = Path(__file__).resolve().parents[4]
    sys.path.insert(0, str(project_root))
    import lancedb
    db_path = project_root / "data" / "lancedb"
    db = lancedb.connect(str(db_path))
    return db.open_table("articles")


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


def strip_html(text: str) -> str:
    """去除 HTML 标签并返回纯文本"""
    if not text:
        return ""
    text = re.sub(r'<[^>]*>', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text[:200]


def format_date(dt) -> Optional[str]:
    """将 datetime 转换为 YYYY-MM-DD 格式字符串"""
    if dt is None:
        return None
    if hasattr(dt, 'strftime'):
        return dt.strftime('%Y-%m-%d')
    return str(dt)


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

    # 构建查询条件 (使用 SQLGuard 防止注入)
    conditions = {}
    if category:
        conditions["source_site"] = category
    if tags:
        conditions["tags"] = [tag.strip() for tag in tags.split(",")]

    where_clause = _sql_guard.build_safe_where(conditions) if conditions else None

    # 执行查询
    try:
        table = get_table()

        # 使用原始 SQL 查询获取所有记录
        if where_clause:
            results = table.search().where(where_clause).limit(page_size).offset(offset).to_list()
            # 获取过滤后的总数
            total_results = table.search().where(where_clause).to_list()
            total = len(total_results)
        else:
            # 使用空向量进行全量搜索（返回所有记录）
            import numpy as np
            dummy_vector = np.zeros(384, dtype=np.float32)
            results = table.search(dummy_vector, vector_column_name="title_embedding").limit(page_size).offset(offset).to_list()
            total = table.count_rows()

        items = [
            ArticleResponse(
                id=r.get("news_id", ""),
                title=r.get("title", ""),
                url=r.get("url", ""),
                content=r.get("content_markdown", ""),
                summary=strip_html(r.get("content_text", "")) if r.get("content_text") else None,
                author=r.get("author", ""),
                published_date=format_date(r.get("publish_date")),
                tags=r.get("tags", []),
                category=r.get("source_site", ""),
                attachments=r.get("attachments", []),
                created_at=r.get("last_updated"),
                updated_at=r.get("last_updated"),
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
    try:
        table = get_table()
        safe_where = _sql_guard.build_safe_where({"news_id": article_id})
        results = table.search().where(safe_where).limit(1).to_list()
        if not results:
            raise HTTPException(status_code=404, detail="Article not found")

        r = results[0]
        return ArticleResponse(
            id=r.get("news_id", ""),
            title=r.get("title", ""),
            url=r.get("url", ""),
            content=r.get("content_markdown", ""),
            summary=strip_html(r.get("content_text", "")) if r.get("content_text") else None,
            author=r.get("author", ""),
            published_date=format_date(r.get("publish_date")),
            tags=r.get("tags", []),
            category=r.get("source_site", ""),
            attachments=r.get("attachments", []),
            created_at=r.get("last_updated"),
            updated_at=r.get("last_updated"),
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
        existing = repo.get(article_id)
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
        existing = repo.get(article_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Article not found")

        repo.delete_one(article_id)

        return {"message": "Article deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
