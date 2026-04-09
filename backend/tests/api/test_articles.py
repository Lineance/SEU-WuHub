"""Articles API 路由单元测试"""

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def mock_repository():
    """模拟 ArticleRepository"""
    with patch("backend.app.api.v1.articles.get_repo") as mock_get_repo:
        mock_repo = MagicMock()
        mock_get_repo.return_value = mock_repo
        yield mock_repo


@pytest.fixture
def mock_table():
    """模拟 LanceDB 表"""
    with patch("backend.app.api.v1.articles.get_table") as mock_get_table:
        mock_t = MagicMock()
        mock_get_table.return_value = mock_t
        yield mock_t


@pytest.fixture
def client():
    """创建测试客户端"""
    # 延迟导入避免路径问题
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).resolve().parents[4]))

    from fastapi.testclient import TestClient
    from backend.app.main import app

    return TestClient(app)


class TestListArticlesEndpoint:
    """GET /api/v1/articles/ 端点测试"""

    def test_list_articles_returns_empty_list(self, client: TestClient, mock_table) -> None:
        """测试空列表返回"""
        mock_table.search.return_value.where.return_value.limit.return_value.offset.return_value.to_list.return_value = []
        mock_table.count_rows.return_value = 0

        response = client.get("/api/v1/articles/")

        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["total"] == 0

    def test_list_articles_with_pagination(self, client: TestClient, mock_table) -> None:
        """测试分页参数"""
        mock_table.search.return_value.where.return_value.limit.return_value.offset.return_value.to_list.return_value = []
        mock_table.count_rows.return_value = 0

        response = client.get("/api/v1/articles/?page=2&page_size=20")

        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 2
        assert data["page_size"] == 20

    def test_list_articles_source_filter(self, client: TestClient, mock_table) -> None:
        """测试来源筛选"""
        mock_table.search.return_value.where.return_value.limit.return_value.offset.return_value.to_list.return_value = []
        mock_table.count_rows.return_value = 0

        response = client.get("/api/v1/articles/?source=jwc")

        assert response.status_code == 200

    def test_list_articles_tags_filter(self, client: TestClient, mock_table) -> None:
        """测试标签筛选"""
        mock_table.search.return_value.where.return_value.limit.return_value.offset.return_value.to_list.return_value = []
        mock_table.count_rows.return_value = 0

        response = client.get("/api/v1/articles/?tags=tag1,tag2")

        assert response.status_code == 200


class TestGetArticleEndpoint:
    """GET /api/v1/articles/{article_id} 端点测试"""

    def test_get_article_not_found(self, client: TestClient, mock_table) -> None:
        """测试文章不存在"""
        mock_table.search.return_value.where.return_value.limit.return_value.to_list.return_value = []

        response = client.get("/api/v1/articles/nonexistent")

        assert response.status_code == 404

    def test_get_article_success(self, client: TestClient, mock_table) -> None:
        """测试获取文章成功"""
        mock_table.search.return_value.where.return_value.limit.return_value.to_list.return_value = [
            {
                "news_id": "test_001",
                "title": "测试文章",
                "url": "https://example.com/test",
                "content_markdown": "# 测试",
                "content_text": "测试内容",
                "author": "作者",
                "publish_date": "2024-05-20",
                "tags": ["tag1"],
                "source_site": "测试站点",
                "attachments": [],
                "last_updated": "2024-05-20T10:00:00",
            }
        ]

        response = client.get("/api/v1/articles/test_001")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "test_001"
        assert data["title"] == "测试文章"


class TestHealthEndpoint:
    """健康检查端点测试"""

    def test_health_check(self, client: TestClient) -> None:
        """测试健康检查"""
        response = client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "version" in data

    def test_root_endpoint(self, client: TestClient) -> None:
        """测试根路径"""
        response = client.get("/")

        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "version" in data
