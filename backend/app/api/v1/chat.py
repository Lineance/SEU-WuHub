"""
Chat API - SSE streaming endpoint for RAG conversations (READ-ONLY)

Responsibilities:
    - GET /api/v1/chat/stream SSE endpoint
    - Agent service integration with streaming response
    - Session management for continuous dialogue
"""

import json
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from data.repository import ArticleRepository
from data.schema import ArticleFields

router = APIRouter()

# In-memory session storage (for demo purposes)
# In production, use Redis or database
_sessions: dict[str, list[dict]] = {}


def get_repo() -> ArticleRepository:
    """Get or create the article repository instance."""
    return ArticleRepository()


def article_to_response(article: dict[str, Any]) -> dict[str, Any]:
    """Convert article record to API response format."""
    publish_date = article.get(ArticleFields.PUBLISH_DATE)
    return {
        "id": article.get(ArticleFields.NEWS_ID, ""),
        "title": article.get(ArticleFields.TITLE, ""),
        "summary": (
            article.get(ArticleFields.CONTENT_TEXT, "")[:200]
            if article.get(ArticleFields.CONTENT_TEXT)
            else ""
        ),
        "source": article.get(ArticleFields.SOURCE_SITE, ""),
        "source_url": article.get(ArticleFields.URL, ""),
        "published_at": publish_date.isoformat() if publish_date else None,
        "tags": article.get(ArticleFields.TAGS, []),
    }


def generate_demo_response(query: str, context: list[dict]) -> str:
    """Generate a demo response based on retrieved context."""
    if context:
        top_article = context[0]
        return (
            f"根据检索到的信息，关于「{query}」，"
            f"我找到了一篇相关文章：\n\n"
            f"**{top_article['title']}**\n"
            f"{top_article['summary']}...\n\n"
            f"来源：{top_article['source']}"
        )
    else:
        return (
            f"抱歉，我没有找到与「{query}」相关的明确信息。"
            f"建议您：\n"
            f"1. 尝试使用更简洁的关键词\n"
            f"2. 查看最新公告列表\n"
            f"3. 联系相关部门获取帮助"
        )


async def sse_generator(session_id: str, query: str):
    """Generate SSE stream for chat response."""
    try:
        repo = get_repo()

        # Store user message
        if session_id not in _sessions:
            _sessions[session_id] = []
        _sessions[session_id].append(
            {"role": "user", "content": query, "timestamp": datetime.now().isoformat()}
        )

        # Retrieve relevant articles
        context = repo.search_text(query, limit=3)
        context_data = [article_to_response(a) for a in context]

        # Send context citation event
        if context_data:
            yield f"event: context\ndata: {json.dumps(context_data, ensure_ascii=False)}\n\n"

        # Generate response (streaming word by word for demo)
        response = generate_demo_response(query, context_data)

        # Stream the response
        for i in range(0, len(response), 10):
            chunk = response[i : i + 10]
            yield f"event: chunk\ndata: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"

        # Send done event
        yield f"event: done\ndata: {json.dumps({'session_id': session_id}, ensure_ascii=False)}\n\n"

        # Store assistant message
        _sessions[session_id].append(
            {"role": "assistant", "content": response, "timestamp": datetime.now().isoformat()}
        )

    except Exception as e:
        yield f"event: error\ndata: {json.dumps({'message': str(e)}, ensure_ascii=False)}\n\n"


@router.get("/chat/stream")
async def chat_stream(
    q: str = Query(..., min_length=1, description="User query"),
    session_id: str = Query(None, description="Session ID for continuous conversation"),
):
    """
    SSE endpoint for streaming chat responses.

    - **q**: User query string
    - **session_id**: Optional session ID for conversation continuity

    Events:
    - `context`: Citation articles from RAG
    - `chunk`: Response text chunks
    - `done`: Response complete
    - `error`: Error occurred
    """
    # Generate new session ID if not provided
    if not session_id:
        session_id = str(uuid.uuid4())

    return StreamingResponse(
        sse_generator(session_id, q),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Session-ID": session_id,
        },
    )


@router.get("/chat/history")
async def get_chat_history(
    session_id: str = Query(..., description="Session ID"),
):
    """Get chat history for a session."""
    from fastapi.responses import JSONResponse

    if session_id not in _sessions:
        return JSONResponse(
            content={"success": True, "data": [], "message": "No history found"}
        )

    return JSONResponse(
        content={
            "success": True,
            "data": _sessions[session_id],
            "message": "History retrieved",
        }
    )
