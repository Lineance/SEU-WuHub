"""ReAct-style agent loop with tool orchestration."""

import asyncio
import re
from collections.abc import AsyncIterator
from typing import Any

from backend.agent.config import AgentConfig
from backend.agent.events.types import AgentEvent
from backend.agent.memory.buffer import ConversationBuffer
from backend.agent.tools.registry import ToolRegistry


class ReActAgent:
    def __init__(
        self,
        *,
        tool_registry: ToolRegistry,
        memory: ConversationBuffer,
        config: AgentConfig,
    ) -> None:
        self._tools = tool_registry
        self._memory = memory
        self._config = config

    def _pick_tool(self, query: str) -> tuple[str, dict[str, Any]]:
        url_match = re.search(r"https?://[^\s]+", query)
        if url_match:
            return "web_url_fetch", {"url": url_match.group(0)}

        if any(token in query for token in ["统计", "数量", "多少", "count", "筛选"]):
            conditions: dict[str, Any] = {}
            if "教务" in query:
                conditions["source_site"] = "jwc"
            return "sql_service", {"conditions": conditions, "limit": 10}

        return "search_keyword", {"query": query, "limit": 5}

    def _compose_answer(self, query: str, tool_name: str, tool_content: dict[str, Any]) -> str:
        results = tool_content.get("results")
        if isinstance(results, list) and results:
            lines = [f"根据你的问题“{query}”，我找到以下相关信息："]
            for idx, item in enumerate(results[:5], start=1):
                title = item.get("title", "(无标题)")
                category = item.get("category", "未知来源")
                url = item.get("url", "")
                lines.append(f"{idx}. {title} [{category}] {url}")
            lines.append("如需，我可以继续按时间范围或标签进一步筛选。")
            return "\n".join(lines)

        if tool_name == "web_url_fetch" and tool_content.get("snippet"):
            snippet = str(tool_content.get("snippet", ""))
            return f"我已抓取到网页内容片段，可用于事实核查：\n{snippet[:500]}"

        return "我已完成查询，但没有找到可用结果。你可以换个关键词或增加筛选条件。"

    async def run_stream(
        self,
        *,
        query: str,
        session_id: str,
        history: list[dict[str, Any]] | None = None,
    ) -> AsyncIterator[AgentEvent]:
        step = 1
        history = history or []

        for item in history[-self._config.history_window :]:
            role = str(item.get("role", "user"))
            content = str(item.get("content", ""))
            self._memory.append(session_id, role=role, content=content)

        self._memory.append(session_id, role="user", content=query)

        yield AgentEvent(
            type="thought",
            step=step,
            payload={
                "message": "正在分析问题并规划工具调用",
                "available_tools": self._tools.list_tools(),
            },
        )

        tool_name, tool_params = self._pick_tool(query)
        yield AgentEvent(
            type="tool_call", step=step, payload={"tool": tool_name, "input": tool_params}
        )

        try:
            tool_result = await asyncio.wait_for(
                self._tools.execute(tool_name, tool_params),
                timeout=self._config.tool_timeout_seconds,
            )
        except TimeoutError:
            yield AgentEvent(
                type="error",
                step=step,
                payload={"message": "工具调用超时", "tool": tool_name},
            )
            yield AgentEvent(type="done", step=step, payload={"reason": "tool_timeout"})
            return

        if not tool_result.ok:
            yield AgentEvent(
                type="tool_result",
                step=step,
                payload={"tool": tool_name, "ok": False, "error": tool_result.error},
            )
            fallback = "工具执行失败，我会基于现有信息继续回答。请尝试更具体的问题。"
            self._memory.append(session_id, role="assistant", content=fallback)
            yield AgentEvent(type="message", step=step, payload={"content": fallback})
            yield AgentEvent(type="done", step=step, payload={"reason": "tool_error"})
            return

        yield AgentEvent(
            type="tool_result",
            step=step,
            payload={"tool": tool_name, "ok": True, "result": tool_result.content},
        )

        answer = self._compose_answer(query, tool_name, tool_result.content)
        self._memory.append(session_id, role="assistant", content=answer)

        yield AgentEvent(type="message", step=step, payload={"content": answer})
        yield AgentEvent(type="done", step=step, payload={"reason": "completed"})
