"""Chat API Router using SSE streaming."""

from collections.abc import AsyncGenerator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from backend.app.schemas.agent import ChatRequest
from backend.app.services.agent_service import AgentService

router = APIRouter(prefix="/chat", tags=["chat"])

_service: AgentService | None = None


def get_agent_service() -> AgentService:
    global _service
    if _service is None:
        _service = AgentService()
    return _service


async def _stream_response(request: ChatRequest) -> AsyncGenerator[str]:
    history = [{"role": msg.role, "content": msg.content} for msg in request.history]
    async for chunk in get_agent_service().stream_chat(
        query=request.query,
        session_id=request.session_id,
        history=history,
    ):
        yield chunk


@router.post("/stream")
async def stream_chat(request: ChatRequest):
    """SSE chat endpoint for ReAct agent."""
    try:
        return StreamingResponse(
            _stream_response(request),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc
