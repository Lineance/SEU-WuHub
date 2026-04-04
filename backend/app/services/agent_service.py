"""Application service for agent orchestration."""

import logging
from collections.abc import AsyncIterator
from pathlib import Path

from dotenv import load_dotenv
from litellm import acompletion

from backend.agent.config import AgentConfig
from backend.agent.llm.client import LLMDecisionClient

logger = logging.getLogger(__name__)
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
    _env_loaded = False

    def __init__(self, config: AgentConfig | None = None) -> None:
        if not AgentService._env_loaded:
            backend_dir = Path(__file__).resolve().parents[2]  # backend/app/services -> backend
            agent_dir = backend_dir / "agent"
            load_dotenv(agent_dir / ".env", override=False)
            load_dotenv(backend_dir / ".env", override=False)
            AgentService._env_loaded = True

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
        self._decision_client = LLMDecisionClient(
            model=self._config.llm_model,
            temperature=self._config.temperature,
            max_tokens=self._config.max_tokens,
            timeout_seconds=self._config.llm_timeout_seconds,
        )
        self._agent = ReActAgent(
            tool_registry=registry,
            memory=self._memory,
            config=self._config,
            decision_client=self._decision_client,
        )

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

    async def generate_title(self, content: str) -> str | None:
        """Generate a short title from the first user message content."""
        from backend.agent.llm.client import LLMDecisionClient

        client = LLMDecisionClient(
            model=self._config.llm_model,
            temperature=0.3,
            max_tokens=50,
            timeout_seconds=10.0,
        )

        system_prompt = (
            "你是一个校园助手。根据用户的第一条消息，生成一个简短的中文标题（不超过20个字）。"
            "只输出标题，不要加引号、冒号或其他符号，不要任何解释。"
        )

        try:
            response = await acompletion(
                model=client._model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": content[:200]},
                ],
                temperature=0.3,
                max_tokens=50,
                timeout=10.0,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Title generation failed: %s", exc)
            return None

        choices = getattr(response, "choices", None)
        if not choices:
            return None

        first_choice = choices[0]
        message = getattr(first_choice, "message", None)
        content_out = getattr(message, "content", "") if message is not None else ""
        return str(content_out).strip() or None
