from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).resolve().parents[4]))

    from backend.app.main import app

    return TestClient(app)


class _FakeService:
    async def stream_chat(self, *, query: str, session_id: str, history: list[dict[str, str]]):
        assert query
        assert session_id
        yield 'event: thought\\ndata: {"type":"thought","step":1,"payload":{}}\\n\\n'
        yield 'event: done\\ndata: {"type":"done","step":1,"payload":{"reason":"completed"}}\\n\\n'


def test_chat_stream_endpoint_returns_sse(client: TestClient) -> None:
    with patch("backend.app.api.v1.chat.get_agent_service", return_value=_FakeService()):
        response = client.post(
            "/api/v1/chat/stream",
            json={"query": "补考时间", "session_id": "s1", "history": []},
        )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert "event: thought" in response.text
    assert "event: done" in response.text
