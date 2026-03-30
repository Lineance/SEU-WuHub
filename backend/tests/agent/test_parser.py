from backend.agent.core.parser import parse_action


def test_parse_action_with_valid_json() -> None:
    text = 'before {"tool": "search_keyword", "input": {"query": "补考"}} after'
    payload = parse_action(text)
    assert payload is not None
    assert payload["tool"] == "search_keyword"
    assert payload["input"]["query"] == "补考"


def test_parse_action_with_invalid_payload() -> None:
    text = "no action here"
    assert parse_action(text) is None
