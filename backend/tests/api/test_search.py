"""Search API 路由单元测试"""

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def mock_engine():
    """模拟 RetrievalEngine"""
    with patch("backend.app.api.v1.search.get_engine") as mock_get_engine:
        mock_engine = MagicMock()
        mock_get_engine.return_value = mock_engine
        yield mock_engine


@pytest.fixture
def client():
    """创建测试客户端"""
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).resolve().parents[4]))

    from fastapi.testclient import TestClient
    from backend.app.main import app

    return TestClient(app)


class TestSearchPostEndpoint:
    """POST /api/v1/search/ 端点测试"""

    def test_search_post_returns_empty_results(self, client: TestClient, mock_engine) -> None:
        """测试空搜索结果"""
        mock_engine.search.return_value = {"results": [], "total": 0}

        response = client.post(
            "/api/v1/search/",
            json={"query": "测试", "limit": 10},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["query"] == "测试"
        assert data["results"] == []
        assert data["total"] == 0

    def test_search_post_with_results(self, client: TestClient, mock_engine) -> None:
        """测试返回搜索结果"""
        mock_engine.search.return_value = {
            "results": [
                {
                    "news_id": "test_001",
                    "title": "测试文章",
                    "url": "https://example.com/test",
                    "content_text": "测试内容",
                    "source_site": "测试站点",
                    "tags": ["tag1"],
                    "publish_date": "2024-05-20",
                    "_score": 0.95,
                }
            ],
            "total": 1,
        }

        response = client.post(
            "/api/v1/search/",
            json={"query": "测试", "limit": 10},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert len(data["results"]) == 1
        assert data["results"][0]["title"] == "测试文章"

    def test_search_post_with_category_filter(self, client: TestClient, mock_engine) -> None:
        """测试分类筛选"""
        mock_engine.search.return_value = {"results": [], "total": 0}

        response = client.post(
            "/api/v1/search/",
            json={"query": "测试", "limit": 10, "category": "jwc"},
        )

        assert response.status_code == 200
        mock_engine.search.assert_called_once()
        call_kwargs = mock_engine.search.call_args.kwargs
        assert call_kwargs["source_site"] == "jwc"

    def test_search_post_with_tags_filter(self, client: TestClient, mock_engine) -> None:
        """测试标签筛选"""
        mock_engine.search.return_value = {"results": [], "total": 0}

        response = client.post(
            "/api/v1/search/",
            json={"query": "测试", "limit": 10, "tags": ["tag1", "tag2"]},
        )

        assert response.status_code == 200
        mock_engine.search.assert_called_once()
        call_kwargs = mock_engine.search.call_args.kwargs
        assert call_kwargs["tags"] == ["tag1", "tag2"]

    def test_search_post_with_date_range(self, client: TestClient, mock_engine) -> None:
        """测试日期范围筛选"""
        mock_engine.search.return_value = {"results": [], "total": 0}

        response = client.post(
            "/api/v1/search/",
            json={
                "query": "测试",
                "limit": 10,
                "start_date": "2024-01-01",
                "end_date": "2024-12-31",
            },
        )

        assert response.status_code == 200
        mock_engine.search.assert_called_once()
        call_kwargs = mock_engine.search.call_args.kwargs
        assert call_kwargs["start_date"] == "2024-01-01"
        assert call_kwargs["end_date"] == "2024-12-31"


class TestSearchGetEndpoint:
    """GET /api/v1/search/ 端点测试"""

    def test_search_get_returns_empty_results(self, client: TestClient, mock_engine) -> None:
        """测试空搜索结果"""
        mock_engine.search.return_value = {"results": [], "total": 0}

        response = client.get("/api/v1/search/?q=测试")

        assert response.status_code == 200
        data = response.json()
        assert data["query"] == "测试"
        assert data["results"] == []

    def test_search_get_with_results(self, client: TestClient, mock_engine) -> None:
        """测试返回搜索结果"""
        mock_engine.search.return_value = {
            "results": [
                {
                    "news_id": "test_001",
                    "title": "测试文章",
                    "url": "https://example.com/test",
                    "content_text": "测试内容",
                    "source_site": "测试站点",
                    "tags": [],
                    "publish_date": "2024-05-20",
                    "_score": 0.9,
                }
            ],
            "total": 1,
        }

        response = client.get("/api/v1/search/?q=测试&limit=5")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1

    def test_search_get_with_pagination(self, client: TestClient, mock_engine) -> None:
        """测试分页参数"""
        mock_engine.search.return_value = {"results": [], "total": 0}

        response = client.get("/api/v1/search/?q=测试&limit=20")

        assert response.status_code == 200
        mock_engine.search.assert_called_once()
        call_kwargs = mock_engine.search.call_args.kwargs
        assert call_kwargs["limit"] == 20

    def test_search_get_with_tags_comma_separated(self, client: TestClient, mock_engine) -> None:
        """测试逗号分隔的标签"""
        mock_engine.search.return_value = {"results": [], "total": 0}

        response = client.get("/api/v1/search/?q=测试&tags=tag1,tag2,tag3")

        assert response.status_code == 200
        mock_engine.search.assert_called_once()
        call_kwargs = mock_engine.search.call_args.kwargs
        assert call_kwargs["tags"] == ["tag1", "tag2", "tag3"]

    def test_search_get_empty_query(self, client: TestClient, mock_engine) -> None:
        """测试空查询"""
        mock_engine.search.return_value = {"results": [], "total": 0}

        response = client.get("/api/v1/search/")

        assert response.status_code == 200


class TestSearchHelpers:
    """搜索辅助函数测试"""

    def test_strip_html(self, client: TestClient) -> None:
        """测试 HTML 剥离函数"""
        from backend.app.api.v1.search import strip_html

        result = strip_html("<p>段落<b>加粗</b></p>")
        assert "段落" in result
        assert "加粗" in result
        assert "<" not in result

    def test_strip_html_empty(self, client: TestClient) -> None:
        """测试空输入"""
        from backend.app.api.v1.search import strip_html

        result = strip_html("")
        assert result == ""

    def test_format_date_with_datetime(self, client: TestClient) -> None:
        """测试日期格式化"""
        from datetime import datetime

        from backend.app.api.v1.search import format_date

        dt = datetime(2024, 5, 20, 10, 30, 0)
        result = format_date(dt)
        assert "2024" in result or "05" in result or "20" in result

    def test_format_date_with_none(self, client: TestClient) -> None:
        """测试 None 输入"""
        from backend.app.api.v1.search import format_date

        result = format_date(None)
        assert result == ""

    def test_format_date_with_string(self, client: TestClient) -> None:
        """测试字符串日期输入"""
        from backend.app.api.v1.search import format_date

        result = format_date("2024-05-20T10:30:00")
        assert "2024" in result
