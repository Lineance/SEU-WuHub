"""Application service for agent orchestration."""

from collections.abc import AsyncIterator

from backend.agent.config import AgentConfig
from backend.agent.core.agent import ReActAgent
from backend.agent.events.stream import to_sse
from backend.agent.memory.buffer import ConversationBuffer
from backend.agent.tools.fetch import FetchTool
from backend.agent.tools.registry import ToolRegistry
from backend.agent.tools.search import SearchTool
from backend.agent.tools.sql import SQLTool
from backend.database.guard import SQLGuard
from backend.database.repository import ArticleRepository
from backend.retrieval.engine import RetrievalEngine


class AgentService:
    def __init__(self, config: AgentConfig | None = None) -> None:
        self._config = config or AgentConfig()
        self._memory = ConversationBuffer(window_size=self._config.history_window)

        registry = ToolRegistry()
        registry.register(SearchTool(RetrievalEngine()))
        registry.register(SQLTool(ArticleRepository(), SQLGuard()))
        registry.register(
            FetchTool(
                allowed_domains=self._config.allowed_fetch_domains,
                timeout_seconds=self._config.fetch_timeout_seconds,
                retries=self._config.fetch_retry_count,
            )
        )
        self._registry = registry
        self._agent = ReActAgent(tool_registry=registry, memory=self._memory, config=self._config)

    async def stream_chat(
        self,
        *,
        query: str,
        session_id: str,
        history: list[dict[str, str]],
    ) -> AsyncIterator[str]:
        async for event in self._agent.run_stream(
            query=query, session_id=session_id, history=history
        ):
            yield to_sse(event)
