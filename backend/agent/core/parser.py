"""Parser for extracting tool actions from model output."""

import json
import re
from typing import Any

_ACTION_BLOCK = re.compile(r"\{[\s\S]*\}", re.MULTILINE)


def parse_action(text: str) -> dict[str, Any] | None:
    """Extract action JSON from free-form text.

    Expected payload shape:
    {"tool": "search_keyword", "input": {"query": "..."}}
    """
    if not text:
        return None

    match = _ACTION_BLOCK.search(text)
    if not match:
        return None

    snippet = match.group(0).strip()
    try:
        payload = json.loads(snippet)
    except json.JSONDecodeError:
        # Light repair for single quotes.
        repaired = snippet.replace("'", '"')
        try:
            payload = json.loads(repaired)
        except json.JSONDecodeError:
            return None

    if not isinstance(payload, dict):
        return None

    # Backward-compatible alias: {"action": "..."}
    if "tool" not in payload and "action" in payload:
        payload["tool"] = payload.pop("action")

    if "tool" not in payload:
        return None

    tool_name = str(payload.get("tool", "")).strip()
    payload["tool"] = tool_name

    raw_input = payload.get("input")
    if not isinstance(raw_input, dict):
        raw_input = {}

    # For finish actions, allow top-level answer and normalize into input.answer.
    if tool_name == "finish" and "answer" in payload and "answer" not in raw_input:
        raw_input["answer"] = payload.get("answer")

    payload["input"] = raw_input
    return payload
