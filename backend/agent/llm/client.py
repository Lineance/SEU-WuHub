"""LLM client used to decide tool actions for the agent."""

import json
import logging
import os
from typing import Any

from litellm import acompletion

from backend.agent.core.parser import parse_action

logger = logging.getLogger(__name__)


class LLMDecisionClient:
    def __init__(
        self,
        *,
        model: str,
        temperature: float,
        max_tokens: int,
        timeout_seconds: float,
    ) -> None:
        self._model = model
        self._temperature = temperature
        self._max_tokens = max_tokens
        self._timeout_seconds = timeout_seconds

    @staticmethod
    def default_model() -> str:
        return os.getenv("SEU_WUHUB_AGENT_MODEL", "openai/gpt-4o-mini")

    async def decide_action(
        self,
        *,
        query: str,
        history: list[dict[str, Any]],
        available_tools: list[str],
    ) -> dict[str, Any] | None:
        if not available_tools:
            return None

        system_prompt = (
            "You are a planning assistant for a campus QA agent. "
            "Choose the next action and produce strict JSON only. "
            'Output format: {"tool":"tool_name","input":{...}}. '
            'When you already have enough evidence, output {"tool":"finish","input":{"answer":"..."}}. '
            "Do not include markdown fences or extra text."
        )

        user_payload = {
            "query": query,
            "history": history[-6:],
            "available_tools": available_tools,
            "rules": [
                "Prefer search_keyword for general campus Q&A",
                "Use sql_service for explicit filtering/counting/statistics",
                "Use web_url_fetch only when user provides a concrete URL",
                "Use finish when no further tool call is needed",
            ],
        }

        try:
            response = await acompletion(
                model=self._model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
                ],
                temperature=self._temperature,
                max_tokens=self._max_tokens,
                timeout=self._timeout_seconds,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("LLM planning failed, fallback to heuristic planner: %s", exc)
            return None

        choices = getattr(response, "choices", None)
        if not choices:
            return None

        first_choice = choices[0]
        message = getattr(first_choice, "message", None)
        content = getattr(message, "content", "") if message is not None else ""
        if not content:
            return None

        parsed = parse_action(content)
        if not parsed:
            return None

        tool_name = parsed.get("tool")
        if tool_name != "finish" and tool_name not in available_tools:
            return None

        tool_input = parsed.get("input", {})
        if not isinstance(tool_input, dict):
            tool_input = {}

        return {"tool": tool_name, "input": tool_input}

    async def generate_final_answer(
        self,
        *,
        query: str,
        history: list[dict[str, Any]],
        observations: list[dict[str, Any]],
    ) -> str | None:
        """Generate the final user-facing answer from multi-step observations.

        This method calls the underlying LLM with the given ``query``, a truncated
        interaction ``history``, and the collected ``observations`` from previous
        tool calls. The model is instructed to base its answer only on the
        provided observations and to avoid fabricating unsupported details.

        When the available observations do not provide enough grounded
        information to confidently answer the query (that is, when there is
        *insufficient evidence*), the LLM is asked to explicitly state its
        uncertainty and suggest an appropriate follow-up query instead of
        pretending to have a definitive answer. Such uncertainty-aware answers
        are still returned as a normal ``str``.

        Returns:
            str | None: The final natural-language answer from the LLM, or
            ``None`` if the LLM call fails, times out, returns no choices, or
            produces only empty/whitespace content.
        """
        system_prompt = (
            "You are a campus assistant. Generate the final answer based only on observations. "
            "If evidence is insufficient, state uncertainty clearly and suggest a next query. "
            "Answer in Chinese and keep it concise."
        )

        payload = {
            "query": query,
            "history": history[-8:],
            "observations": observations,
        }

        try:
            response = await acompletion(
                model=self._model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
                ],
                # Use a low temperature for final answers to keep them deterministic and
                # closely grounded in the given observations, avoiding creative deviations.
                temperature=min(self._temperature, 0.3),
                max_tokens=self._max_tokens,
                timeout=self._timeout_seconds,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("LLM final answer generation failed, fallback to template: %s", exc)
            return None

        choices = getattr(response, "choices", None)
        if not choices:
            return None

        first_choice = choices[0]
        message = getattr(first_choice, "message", None)
        content = getattr(message, "content", "") if message is not None else ""
        answer = str(content).strip()
        return answer or None
