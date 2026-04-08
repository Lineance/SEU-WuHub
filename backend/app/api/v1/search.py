"""
Search API Router

提供搜索相关的 API 接口。
"""

import sys
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException

# 添加项目根目录到 Python 路径
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from backend.app.services import articles_service, search_service
from backend.retrieval.engine import RetrievalEngine

from ...schemas.search import SearchRequest, SearchResponse

router = APIRouter(prefix="/search", tags=["search"])

# 初始化组件
_engine: Optional[RetrievalEngine] = None


def get_engine() -> RetrievalEngine:
    global _engine
    if _engine is None:
        _engine = RetrievalEngine()
    return _engine


def strip_html(text: str) -> str:
    """兼容旧测试：委托给 service 实现。"""
    return search_service.strip_html(text)


def format_date(dt):
    """兼容旧测试：委托给 service 实现。"""
    return search_service.format_date(dt)


@router.post("", response_model=SearchResponse, include_in_schema=False)
@router.post("/", response_model=SearchResponse)
async def search_articles(request: SearchRequest):
    """
    POST 方式搜索文章
    """
    try:
        return search_service.search_articles(
            engine=get_engine(),
            query=request.query,
            limit=request.limit,
            category=request.category,
            tags=request.tags,
            start_date=request.start_date,
            end_date=request.end_date,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("", include_in_schema=False)
@router.get("/")
async def search_get(
    q: str = "",
    limit: int = 10,
    page: int = 1,
    source: Optional[str] = None,
    tags: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    """
    GET 方式搜索文章

    - **q**: 搜索关键词
    - **limit**: 返回结果数量限制
    - **page**: 页码 (从1开始)
    - **source**: 按来源站点筛选
    - **tags**: 按标签筛选
    - **start_date**: 开始日期 YYYY-MM-DD
    - **end_date**: 结束日期 YYYY-MM-DD
    """
    try:
        if not q and not start_date and not end_date:
            from backend.app.api.v1.articles import get_table
            from backend.database.connection import get_connection
            from backend.database.guard import SQLGuard

            offset = (page - 1) * limit
            result = articles_service.list_articles(
                table=get_table(),
                sql_guard=SQLGuard(),
                page=page,
                page_size=limit,
                category=source,
                tags=tags,
                conn=get_connection(),
            )
            return search_service._to_search_response(
                query=q,
                raw_result={
                    "results": [
                        {
                            "news_id": item.id,
                            "title": item.title,
                            "url": item.url,
                            "content_text": item.content or "",
                            "source_site": item.category,
                            "tags": item.tags,
                            "publish_date": item.published_date,
                        }
                        for item in result.items
                    ],
                    "total": result.total,
                },
            )

        offset = (page - 1) * limit
        return search_service.search_articles(
            engine=get_engine(),
            query=q,
            limit=limit,
            offset=offset,
            category=source,
            tags=tags.split(",") if tags else None,
            start_date=start_date,
            end_date=end_date,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
