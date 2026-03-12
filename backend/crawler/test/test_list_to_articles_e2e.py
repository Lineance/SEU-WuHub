from __future__ import annotations

import argparse

import list_to_articles_e2e as e2e
import pytest


class _FakeListIncrementalCrawler:
    def __init__(self, **kwargs):
        self.kwargs = kwargs

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        return None

    async def crawl_website_incremental(
        self, website_name, max_pages, include_patterns, exclude_patterns
    ):
        assert website_name == "jwc"
        assert max_pages == 31
        return {
            "overrides": {"crawler": {"word_count_threshold": 20}},
            "lists": [
                {
                    "list_url": "https://jwc.seu.edu.cn/jwxx/list.htm",
                    "incremental_count": 1,
                    "state_file": "tmp/a.json",
                    "incremental_urls": ["https://jwc.seu.edu.cn/jwxx/1001.htm"],
                },
                {
                    "list_url": "https://jwc.seu.edu.cn/zxdt/list.htm",
                    "incremental_count": 1,
                    "state_file": "tmp/b.json",
                    "incremental_urls": ["https://jwc.seu.edu.cn/zxdt/2001.htm"],
                },
            ],
            "incremental_urls": [
                "https://jwc.seu.edu.cn/jwxx/1001.htm",
                "https://jwc.seu.edu.cn/zxdt/2001.htm",
            ],
        }


class _FakeArticleCrawler:
    def __init__(self, **kwargs):
        self.kwargs = kwargs

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        return None

    def load_config(self, target, override_config=None):
        class _RunConfig:
            cache_mode = None
            check_cache_freshness = None

        assert len(target) == 2
        assert override_config == {"crawler": {"word_count_threshold": 20}}
        return target, _RunConfig(), None

    async def crawl_articles(self, urls, run_config):
        return [
            {"success": True, "url": urls[0]},
            {"success": True, "url": urls[1]},
        ]


@pytest.mark.asyncio
async def test_run_e2e_website_mode_smoke(monkeypatch):
    monkeypatch.setattr(e2e, "ListIncrementalCrawler", _FakeListIncrementalCrawler)
    monkeypatch.setattr(e2e, "ArticleUrlCrawler", _FakeArticleCrawler)

    args = argparse.Namespace(
        list_url=None,
        website="jwc",
        config_dir=None,
        max_pages=31,
        state_file=None,
        cache_dir=None,
        output=None,
        include_pattern=None,
        exclude_pattern=None,
    )

    summary = await e2e.run_e2e(args)

    assert summary["source_mode"] == "website"
    assert summary["website"] == "jwc"
    assert summary["incremental_url_count"] == 2
    assert summary["article_success_count"] == 2
    assert summary["article_failed_count"] == 0
    assert len(summary["lists"]) == 2
    assert summary["lists"][0]["list_url"] == "https://jwc.seu.edu.cn/jwxx/list.htm"
