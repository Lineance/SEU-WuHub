"""Retrieval Engine 单元测试"""

from typing import Any
from unittest.mock import MagicMock, patch

import pytest


class TestRetrievalEngineInit:
    """RetrievalEngine 初始化测试"""

    def test_engine_init_with_mocked_store(self) -> None:
        """测试使用 mock store 初始化引擎"""
        mock_store = MagicMock()
        mock_store.hybrid_search.return_value = []
        mock_embedder = MagicMock()
        mock_embedder.embed_query.return_value = [0.1] * 384

        from backend.retrieval.engine import RetrievalEngine

        engine = RetrievalEngine(store=mock_store, embedder=mock_embedder)

        assert engine._store is mock_store
        assert engine._embedder is mock_embedder

    def test_engine_init_checks_store_type(self) -> None:
        """测试引擎验证 store 类型"""
        from backend.retrieval.engine import RetrievalEngine

        with pytest.raises(TypeError, match="Expected LanceStore"):
            RetrievalEngine(store="invalid_store")


class TestRetrievalEngineSearch:
    """RetrievalEngine search 方法测试"""

    def test_search_returns_structure(self) -> None:
        """测试搜索返回正确结构"""
        mock_store = MagicMock()
        mock_store.hybrid_search.return_value = []
        mock_embedder = MagicMock()
        mock_embedder.embed_query.return_value = [0.1] * 384

        from backend.retrieval.engine import RetrievalEngine

        engine = RetrievalEngine(store=mock_store, embedder=mock_embedder)
        result = engine.search("测试")

        assert "query" in result
        assert "search_type" in result
        assert "total" in result
        assert "results" in result
        assert result["query"] == "测试"

    def test_search_with_limit(self) -> None:
        """测试带 limit 的搜索"""
        mock_store = MagicMock()
        mock_store.hybrid_search.return_value = [
            {"news_id": "1", "title": "测试1"},
            {"news_id": "2", "title": "测试2"},
        ]
        mock_embedder = MagicMock()
        mock_embedder.embed_query.return_value = [0.1] * 384

        from backend.retrieval.engine import RetrievalEngine

        engine = RetrievalEngine(store=mock_store, embedder=mock_embedder)
        result = engine.search("测试", limit=1)

        assert result["limit"] == 1
        assert len(result["results"]) == 1

    def test_search_vector_type(self) -> None:
        """测试向量搜索类型"""
        mock_store = MagicMock()
        mock_store.vector_search.return_value = []
        mock_embedder = MagicMock()
        mock_embedder.embed_query.return_value = [0.1] * 384

        from backend.retrieval.engine import RetrievalEngine

        engine = RetrievalEngine(store=mock_store, embedder=mock_embedder)
        result = engine.search("测试", search_type="vector")

        assert result["search_type"] == "vector"
        mock_store.vector_search.assert_called_once()

    def test_search_fulltext_type(self) -> None:
        """测试全文搜索类型"""
        mock_store = MagicMock()
        mock_store.fulltext_search.return_value = []
        mock_embedder = MagicMock()
        mock_embedder.embed_query.return_value = [0.1] * 384

        from backend.retrieval.engine import RetrievalEngine

        engine = RetrievalEngine(store=mock_store, embedder=mock_embedder)
        result = engine.search("测试", search_type="fulltext")

        assert result["search_type"] == "fulltext"
        mock_store.fulltext_search.assert_called_once()

    def test_search_hybrid_type(self) -> None:
        """测试混合搜索类型"""
        mock_store = MagicMock()
        mock_store.hybrid_search.return_value = []
        mock_embedder = MagicMock()
        mock_embedder.embed_query.return_value = [0.1] * 384

        from backend.retrieval.engine import RetrievalEngine

        engine = RetrievalEngine(store=mock_store, embedder=mock_embedder)
        result = engine.search("测试", search_type="hybrid")

        assert result["search_type"] == "hybrid"
        mock_store.hybrid_search.assert_called_once()


class TestRetrievalEngineSemanticSearch:
    """RetrievalEngine semantic_search 方法测试"""

    def test_semantic_search_returns_results(self) -> None:
        """测试语义搜索返回结果"""
        mock_store = MagicMock()
        mock_store.vector_search.return_value = [
            {"news_id": "1", "title": "测试", "title_embedding": [0.1] * 384},
        ]
        mock_embedder = MagicMock()
        mock_embedder.embed_query.return_value = [0.1] * 384
        mock_embedder.cosine_similarity.return_value = 0.85

        from backend.retrieval.engine import RetrievalEngine

        engine = RetrievalEngine(store=mock_store, embedder=mock_embedder)
        result = engine.semantic_search("测试")

        assert result["search_type"] == "semantic"
        assert "field" in result


class TestRetrievalEngineKeywordSearch:
    """RetrievalEngine keyword_search 方法测试"""

    def test_keyword_search_returns_results(self) -> None:
        """测试关键词搜索返回结果"""
        mock_store = MagicMock()
        mock_store.fulltext_search.return_value = [
            {"news_id": "1", "title": "测试文章"},
        ]

        from backend.retrieval.engine import RetrievalEngine

        engine = RetrievalEngine(store=mock_store, embedder=MagicMock())
        result = engine.keyword_search("测试")

        assert result["search_type"] == "keyword"
        assert len(result["results"]) > 0

    def test_keyword_search_match_any(self) -> None:
        """测试任意匹配模式"""
        mock_store = MagicMock()
        mock_store.fulltext_search.return_value = [
            {"news_id": "1", "title": "测试文章", "content_text": "内容"},
        ]

        from backend.retrieval.engine import RetrievalEngine

        engine = RetrievalEngine(store=mock_store, embedder=MagicMock())
        result = engine.keyword_search("测试 内容", match_type="any")

        assert result["match_type"] == "any"

    def test_keyword_search_match_all(self) -> None:
        """测试全部匹配模式"""
        mock_store = MagicMock()
        mock_store.fulltext_search.return_value = [
            {"news_id": "1", "title": "测试", "content_text": "文章"},
        ]

        from backend.retrieval.engine import RetrievalEngine

        engine = RetrievalEngine(store=mock_store, embedder=MagicMock())
        result = engine.keyword_search("测试 文章", match_type="all")

        assert result["match_type"] == "all"

    def test_keyword_search_match_phrase(self) -> None:
        """测试短语匹配模式"""
        mock_store = MagicMock()
        mock_store.fulltext_search.return_value = [
            {"news_id": "1", "title": "测试文章", "content_text": "这是一篇测试文章"},
        ]

        from backend.retrieval.engine import RetrievalEngine

        engine = RetrievalEngine(store=mock_store, embedder=MagicMock())
        result = engine.keyword_search("测试文章", match_type="phrase")

        assert result["match_type"] == "phrase"


class TestRetrievalEngineAdvancedSearch:
    """RetrievalEngine advanced_search 方法测试"""

    def test_advanced_search_returns_results(self) -> None:
        """测试高级搜索返回结果"""
        mock_store = MagicMock()
        mock_store.hybrid_search.return_value = []

        from backend.retrieval.engine import RetrievalEngine

        engine = RetrievalEngine(store=mock_store, embedder=MagicMock())
        result = engine.advanced_search(
            "测试",
            vector_weight=0.6,
            keyword_weight=0.4,
        )

        assert "vector_weight" in result or result["search_type"] == "advanced"
