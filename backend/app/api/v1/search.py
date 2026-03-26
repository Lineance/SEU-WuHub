"""
Search API Router

提供搜索相关的 API 接口。
"""

from fastapi import APIRouter, HTTPException
from typing import Optional

from backend.retrieval.engine import RetrievalEngine
from backend.retrieval.schema.article import ArticleQuery

from ...schemas.search import SearchRequest, SearchResponse, SearchResult

router = APIRouter(prefix="/search", tags=["search"])

# 初始化组件
_engine: Optional[RetrievalEngine] = None


def get_engine() -> RetrievalEngine:
    global _engine
    if _engine is None:
        _engine = RetrievalEngine()
    return _engine


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
        # 构建查询
        query = ArticleQuery(
            keyword=request.query,
            limit=request.limit,
            source_site=request.category,
            tags=request.tags,
            keyword_weight=0.3,
            vector_weight=0.7,
        )

        # 执行搜索
        results = engine.hybrid_search(query)

        # 转换为响应格式
        search_results = [
            SearchResult(
                id=r.news_id,
                title=r.title,
                url=r.url,
                summary=r.content_text[:200] if r.content_text else None,
                score=0.9,  # LanceDB 不直接提供分数
                category=r.source_site,
                tags=r.tags,
            )
            for r in results
        ]

        return SearchResponse(
            query=request.query,
            results=search_results,
            total=len(search_results),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/")
async def search_get(
    q: str,
    limit: int = 10,
    category: Optional[str] = None,
    tags: Optional[str] = None,
):
    """
    GET 方式搜索文章

    - **q**: 搜索关键词
    - **limit**: 返回结果数量限制
    - **category**: 按分类筛选
    - **tags**: 按标签筛选
    """
    engine = get_engine()

    try:
        query = ArticleQuery(
            keyword=q,
            limit=limit,
            source_site=category,
            tags=tags.split(",") if tags else None,
            keyword_weight=0.3,
            vector_weight=0.7,
        )

        results = engine.hybrid_search(query)

        search_results = [
            SearchResult(
                id=r.news_id,
                title=r.title,
                url=r.url,
                summary=r.content_text[:200] if r.content_text else None,
                score=0.9,
                category=r.source_site,
                tags=r.tags,
            )
            for r in results
        ]

        return SearchResponse(
            query=q,
            results=search_results,
            total=len(search_results),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
