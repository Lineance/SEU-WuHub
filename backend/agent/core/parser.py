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
    if "tool" not in payload:
        return None
    if "input" not in payload or not isinstance(payload["input"], dict):
        payload["input"] = {}
    return payload
