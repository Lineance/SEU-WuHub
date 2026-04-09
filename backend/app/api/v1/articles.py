"""
Articles API Router

提供文章相关的 API 接口。
"""

import sys
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query

# 添加项目根目录到 Python 路径
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from backend.app.services import articles_service
from backend.database.guard import SQLGuard
from backend.database.repository import ArticleRepository
from backend.retrieval.engine import RetrievalEngine
from backend.retrieval.store import LanceStore

from ...schemas.article import (
    ArticleCreate,
    ArticleListResponse,
    ArticleResponse,
    ArticleUpdate,
)

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


# 缓存表引用
_table_cache: Optional[Any] = None


def get_table():
    """直接获取 LanceDB 表（带缓存）"""
    global _table_cache
    if _table_cache is None:
        import sys
        from pathlib import Path

        # 获取项目根目录 (backend 的父目录的父目录)
        # articles.py -> api/v1 -> app -> backend -> 项目根
        project_root = Path(__file__).resolve().parents[4]
        sys.path.insert(0, str(project_root))
        import lancedb

        db_path = project_root / "data" / "lancedb"
        db = lancedb.connect(str(db_path))
        _table_cache = db.open_table("articles")
    return _table_cache


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


@router.get("", response_model=ArticleListResponse, include_in_schema=False)
@router.get("/", response_model=ArticleListResponse)
async def list_articles(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    source: Optional[str] = None,
    tags: Optional[str] = None,
):
    """
    获取文章列表

    - **page**: 页码
    - **page_size**: 每页数量
    - **source**: 来源站点筛选
    - **tags**: 标签筛选（逗号分隔）
    """
    try:
        from backend.database.connection import get_connection

        return articles_service.list_articles(
            table=get_table(),
            sql_guard=_sql_guard,
            page=page,
            page_size=page_size,
            source=source,
            tags=tags,
            conn=get_connection(),
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
        return articles_service.get_article(
            table=get_table(),
            sql_guard=_sql_guard,
            article_id=article_id,
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
    try:
        return articles_service.create_article(repo=get_repo(), article=article)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{article_id}", response_model=ArticleResponse)
async def update_article(article_id: str, article: ArticleUpdate):
    """
    更新文章

    - **article_id**: 文章唯一标识
    - **article**: 更新后的文章数据
    """
    try:
        return articles_service.update_article(
            repo=get_repo(),
            article_id=article_id,
            article=article,
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
    try:
        return articles_service.delete_article(repo=get_repo(), article_id=article_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
