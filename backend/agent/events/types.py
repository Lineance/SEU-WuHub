"""Event types for streaming agent execution."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

EventType = Literal[
    "thought",
    "tool_call",
    "tool_result",
    "message",
    "done",
    "error",
]


class AgentEvent(BaseModel):
    type: EventType
    step: int = 0
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    payload: dict[str, Any] = Field(default_factory=dict)
