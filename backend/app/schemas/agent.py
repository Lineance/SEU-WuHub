"""Schemas for agent chat streaming API."""

from typing import Any, Literal

from pydantic import BaseModel, Field


class ChatOptions(BaseModel):
    max_steps: int | None = Field(default=None, ge=1, le=10)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    session_id: str = Field(default="default", max_length=128)
    history: list[ChatMessage] = Field(default_factory=list)
    options: ChatOptions | None = None


class AgentEventResponse(BaseModel):
    type: Literal["thought", "tool_call", "tool_result", "message", "done", "error"]
    step: int
    timestamp: str
    payload: dict[str, Any]
