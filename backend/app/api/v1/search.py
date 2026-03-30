"""
Search API Router

提供搜索相关的 API 接口。
"""

from fastapi import APIRouter, HTTPException
from typing import Optional
import re

import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from backend.retrieval.engine import RetrievalEngine

from ...schemas.search import SearchRequest, SearchResponse, SearchResult

router = APIRouter(prefix="/search", tags=["search"])

# 初始化组件
_engine: Optional[RetrievalEngine] = None


def get_engine() -> RetrievalEngine:
    global _engine
    if _engine is None:
        _engine = RetrievalEngine()
    return _engine


def strip_html(text: str) -> str:
    """去除 HTML 标签并返回纯文本摘要"""
    if not text:
        return ""
    text = re.sub(r'<[^>]*>', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text[:200]


def format_date(dt) -> str:
    """将 datetime 转换为 YYYY-MM-DD 格式字符串"""
    if dt is None:
        return ""
    if hasattr(dt, 'strftime'):
        return dt.strftime('%Y-%m-%d')
    return str(dt)[:10]


@router.post("/", response_model=SearchResponse)
async def search_articles(request: SearchRequest):
    """
    搜索文章

    - **query**: 搜索关键词
    - **limit**: 返回结果数量限制
    - **category**: 按分类筛选
    - **tags**: 按标签筛选
    """
    engine = get_engine()

    try:
        # 执行搜索（关键词优先，向量语义作为补充）
        search_result = engine.search(
            query=request.query,
            search_type="hybrid",
            limit=request.limit,
            source_site=request.category,
            tags=request.tags,
            keyword_weight=0.7,
            vector_weight=0.3,
            start_date=request.start_date,
            end_date=request.end_date,
        )

        # 转换为响应格式
        search_results = []
        for r in search_result.get("results", []):
            pub_date = format_date(r.get("publish_date"))
            search_results.append(SearchResult(
                id=r["news_id"],
                title=r["title"],
                url=r["url"],
                summary=strip_html(r.get("content_text", "")) if r.get("content_text") else None,
                score=r.get("_score", 0.9),
                category=r.get("source_site", ""),
                tags=r.get("tags", []),
                published_date=pub_date,
            ))

        return SearchResponse(
            query=request.query,
            results=search_results,
            total=len(search_results),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/")
async def search_get(
    q: str = "",
    limit: int = 10,
    category: Optional[str] = None,
    tags: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    """
    GET 方式搜索文章

    - **q**: 搜索关键词
    - **limit**: 返回结果数量限制
    - **category**: 按分类筛选
    - **tags**: 按标签筛选
    - **start_date**: 开始日期 YYYY-MM-DD
    - **end_date**: 结束日期 YYYY-MM-DD
    """
    engine = get_engine()

    try:
        search_result = engine.search(
            query=q,
            search_type="hybrid",
            limit=limit,
            source_site=category,
            tags=tags.split(",") if tags else None,
            keyword_weight=0.7,
            vector_weight=0.3,
            start_date=start_date,
            end_date=end_date,
        )

        search_results = []
        for r in search_result.get("results", []):
            pub_date = format_date(r.get("publish_date"))
            search_results.append(SearchResult(
                id=r["news_id"],
                title=r["title"],
                url=r["url"],
                summary=strip_html(r.get("content_text", "")) if r.get("content_text") else None,
                score=r.get("_score", 0.9),
                category=r.get("source_site", ""),
                tags=r.get("tags", []),
                published_date=pub_date,
            ))

        return SearchResponse(
            query=q,
            results=search_results,
            total=len(search_results),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
