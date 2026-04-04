"""Agent runtime configuration."""

from pydantic import BaseModel, Field


class AgentConfig(BaseModel):
    llm_model: str = Field(default="openai/gpt-4o-mini")
    llm_timeout_seconds: float = Field(default=20.0, gt=0)
    max_steps: int = Field(default=5, ge=1, le=10)
    history_window: int = Field(default=5, ge=1, le=20)
    tool_timeout_seconds: float = Field(default=8.0, gt=0)
    fetch_timeout_seconds: float = Field(default=10.0, gt=0)
    fetch_retry_count: int = Field(default=1, ge=0, le=3)
    temperature: float = Field(default=0.2, ge=0.0, le=1.0)
    max_tokens: int = Field(default=1024, ge=128, le=4096)
    allowed_fetch_domains: list[str] = Field(default_factory=lambda: ["seu.edu.cn"])
