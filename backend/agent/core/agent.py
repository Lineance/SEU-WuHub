"""ReAct-style agent loop with tool orchestration."""

import asyncio
import re
from collections.abc import AsyncIterator
from typing import Any, Protocol

from backend.agent.config import AgentConfig
from backend.agent.events.types import AgentEvent
from backend.agent.memory.buffer import ConversationBuffer
from backend.agent.tools.registry import ToolRegistry


class DecisionClient(Protocol):
    async def decide_action(
        self,
        *,
        query: str,
        history: list[dict[str, Any]],
        available_tools: list[str],
    ) -> dict[str, Any] | None: ...


class ReActAgent:
    def __init__(
        self,
        *,
        tool_registry: ToolRegistry,
        memory: ConversationBuffer,
        config: AgentConfig,
        decision_client: DecisionClient | None = None,
    ) -> None:
        self._tools = tool_registry
        self._memory = memory
        self._config = config
        self._decision_client = decision_client

    def _pick_tool_fallback(self, query: str) -> tuple[str, dict[str, Any]]:
        url_match = re.search(r"https?://[^\s]+", query)
        if url_match:
            return "web_url_fetch", {"url": url_match.group(0)}

        if any(token in query for token in ["统计", "数量", "多少", "count", "筛选"]):
            conditions: dict[str, Any] = {}
            if "教务" in query:
                conditions["source_site"] = "jwc"
            return "sql_service", {"conditions": conditions, "limit": 10}

        return "search_keyword", {"query": query, "limit": 5}

    async def _pick_tool(self, session_id: str, query: str) -> tuple[str, dict[str, Any], str]:
        available_tools = self._tools.list_tools()
        if self._decision_client is not None:
            action = await self._decision_client.decide_action(
                query=query,
                history=self._memory.read(session_id),
                available_tools=available_tools,
            )
            if action:
                tool_name = str(action.get("tool", "")).strip()
                params = action.get("input", {})
                if isinstance(params, dict) and (
                    tool_name in available_tools or tool_name == "finish"
                ):
                    return tool_name, params, "llm"

            tool_name, params = self._pick_tool_fallback(query)
            return tool_name, params, "heuristic"

        tool_name, params = self._pick_tool_fallback(query)
        return tool_name, params, "heuristic"

    @staticmethod
    def _observation_text(tool_name: str, tool_result: dict[str, Any]) -> str:
        total = tool_result.get("total")
        if isinstance(total, int):
            return f"{tool_name} returned {total} records"
        return f"{tool_name} completed"

    @staticmethod
    def _extract_sources(observations: list[dict[str, Any]]) -> list[str]:
        sources: list[str] = []
        seen: set[str] = set()
        for observation in observations:
            result = observation.get("result", {})
            rows = result.get("results") if isinstance(result, dict) else None
            if not isinstance(rows, list):
                continue
            for row in rows:
                if not isinstance(row, dict):
                    continue
                url = str(row.get("url", "")).strip()
                if not url or url in seen:
                    continue
                seen.add(url)
                sources.append(url)
        return sources

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

    async def _build_final_answer(
        self,
        *,
        query: str,
        session_id: str,
        observations: list[dict[str, Any]],
        fallback_tool_name: str,
        fallback_tool_content: dict[str, Any],
    ) -> str:
        if self._decision_client is not None:
            generator = getattr(self._decision_client, "generate_final_answer", None)
            if callable(generator):
                llm_answer = await generator(
                    query=query,
                    history=self._memory.read(session_id),
                    observations=observations,
                )
                if llm_answer:
                    return llm_answer

        return self._compose_answer(query, fallback_tool_name, fallback_tool_content)

    async def run_stream(
        self,
        *,
        query: str,
        session_id: str,
        history: list[dict[str, Any]] | None = None,
    ) -> AsyncIterator[AgentEvent]:
        step = 1
        history = history or []
        last_success_tool = ""
        last_success_content: dict[str, Any] = {}
        observations: list[dict[str, Any]] = []

        for item in history[-self._config.history_window :]:
            role = str(item.get("role", "user"))
            content = str(item.get("content", ""))
            self._memory.append(session_id, role=role, content=content)

        self._memory.append(session_id, role="user", content=query)

        while step <= self._config.max_steps:
            yield AgentEvent(
                type="thought",
                step=step,
                payload={
                    "message": f"正在进行第 {step} 轮分析与决策",
                    "available_tools": self._tools.list_tools(),
                },
            )

            tool_name, tool_params, planner = await self._pick_tool(session_id, query)
            call_id = f"step-{step}-{tool_name}"
            yield AgentEvent(
                type="tool_call",
                step=step,
                call_id=call_id,
                payload={"tool": tool_name, "input": tool_params, "planner": planner},
            )

            if planner == "heuristic":
                yield AgentEvent(
                    type="warning",
                    step=step,
                    call_id=call_id,
                    payload={
                        "message": "LLM 规划不可用，已回退到规则策略",
                        "recoverable": True,
                    },
                )

            if tool_name == "finish":
                answer = str(tool_params.get("answer", "")).strip()
                if not answer:
                    if last_success_tool:
                        observations.append(
                            {
                                "step": step,
                                "tool": "finish",
                                "input": tool_params,
                                "result": {},
                            }
                        )
                        answer = await self._build_final_answer(
                            query=query,
                            session_id=session_id,
                            observations=observations,
                            fallback_tool_name=last_success_tool,
                            fallback_tool_content=last_success_content,
                        )
                    else:
                        answer = "我已完成分析，但缺少可输出的最终结论。"

                self._memory.append(session_id, role="assistant", content=answer)
                yield AgentEvent(type="message", step=step, payload={"content": answer})
                yield AgentEvent(
                    type="done",
                    step=step,
                    payload={"reason": "completed", "sources": self._extract_sources(observations)},
                )
                return

            try:
                tool_result = await asyncio.wait_for(
                    self._tools.execute(tool_name, tool_params),
                    timeout=self._config.tool_timeout_seconds,
                )
            except TimeoutError:
                yield AgentEvent(
                    type="error",
                    step=step,
                    call_id=call_id,
                    payload={"message": "工具调用超时", "tool": tool_name},
                )
                yield AgentEvent(
                    type="done",
                    step=step,
                    payload={
                        "reason": "tool_timeout",
                        "sources": self._extract_sources(observations),
                    },
                )
                return

            if not tool_result.ok:
                yield AgentEvent(
                    type="tool_result",
                    step=step,
                    call_id=call_id,
                    payload={"tool": tool_name, "ok": False, "error": tool_result.error},
                )
                yield AgentEvent(
                    type="warning",
                    step=step,
                    call_id=call_id,
                    payload={
                        "message": "工具执行失败，已进入降级回答路径",
                        "recoverable": True,
                    },
                )
                fallback = "工具执行失败，我会基于现有信息继续回答。请尝试更具体的问题。"
                self._memory.append(session_id, role="assistant", content=fallback)
                yield AgentEvent(type="message", step=step, payload={"content": fallback})
                yield AgentEvent(
                    type="done",
                    step=step,
                    payload={
                        "reason": "tool_error",
                        "sources": self._extract_sources(observations),
                    },
                )
                return

            yield AgentEvent(
                type="tool_result",
                step=step,
                call_id=call_id,
                payload={"tool": tool_name, "ok": True, "result": tool_result.content},
            )

            last_success_tool = tool_name
            last_success_content = tool_result.content
            observations.append(
                {
                    "step": step,
                    "tool": tool_name,
                    "input": tool_params,
                    "result": tool_result.content,
                }
            )
            self._memory.append(
                session_id,
                role="tool",
                content=self._observation_text(tool_name, tool_result.content),
            )

            step += 1

        if last_success_tool:
            answer = await self._build_final_answer(
                query=query,
                session_id=session_id,
                observations=observations,
                fallback_tool_name=last_success_tool,
                fallback_tool_content=last_success_content,
            )
        else:
            answer = "达到最大推理步数，仍未生成最终答案。请缩小问题范围后重试。"

        self._memory.append(session_id, role="assistant", content=answer)
        yield AgentEvent(type="message", step=self._config.max_steps, payload={"content": answer})
        yield AgentEvent(
            type="done",
            step=self._config.max_steps,
            payload={"reason": "max_steps", "sources": self._extract_sources(observations)},
        )
