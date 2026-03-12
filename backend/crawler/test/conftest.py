from __future__ import annotations

import sys
import types
from dataclasses import dataclass, field
from pathlib import Path


class _CacheMode:
    ENABLED = "ENABLED"
    DISABLED = "DISABLED"
    READ_ONLY = "READ_ONLY"
    WRITE_ONLY = "WRITE_ONLY"
    BYPASS = "BYPASS"


@dataclass
class _BrowserConfig:
    _data: dict = field(default_factory=dict)

    def __init__(self, **kwargs):
        object.__setattr__(self, "_data", dict(kwargs))

    def __getattr__(self, item):
        return self._data.get(item)

    def __setattr__(self, key, value):
        if key == "_data":
            object.__setattr__(self, key, value)
            return
        self._data[key] = value

    def clone(self):
        return _BrowserConfig(**self._data)


@dataclass
class _CrawlerRunConfig:
    _data: dict = field(default_factory=dict)

    def __init__(self, **kwargs):
        object.__setattr__(self, "_data", dict(kwargs))

    def __getattr__(self, item):
        return self._data.get(item)

    def __setattr__(self, key, value):
        if key == "_data":
            object.__setattr__(self, key, value)
            return
        self._data[key] = value

    def clone(self):
        return _CrawlerRunConfig(**self._data)


class _FakeResult:
    def __init__(self, success: bool, links: dict | None = None):
        self.success = success
        self.links = links or {"internal": []}


class _AsyncWebCrawler:
    results_by_url: dict[str, _FakeResult] = {}

    def __init__(self, config=None, base_directory=None):
        self.config = config
        self.base_directory = base_directory
        self.started = False

    async def start(self):
        self.started = True

    async def close(self):
        self.started = False

    async def arun(self, url: str, config=None):
        return self.results_by_url.get(url, _FakeResult(False))


class _BFSDeepCrawlStrategy:
    def __init__(self, **kwargs):
        self.kwargs = kwargs


def _install_fake_crawl4ai() -> None:
    crawl4ai = types.ModuleType("crawl4ai")
    crawl4ai.AsyncWebCrawler = _AsyncWebCrawler
    crawl4ai.BrowserConfig = _BrowserConfig
    crawl4ai.CacheMode = _CacheMode
    crawl4ai.CrawlerRunConfig = _CrawlerRunConfig

    deep_crawling = types.ModuleType("crawl4ai.deep_crawling")
    bfs_strategy = types.ModuleType("crawl4ai.deep_crawling.bfs_strategy")
    bfs_strategy.BFSDeepCrawlStrategy = _BFSDeepCrawlStrategy

    sys.modules["crawl4ai"] = crawl4ai
    sys.modules["crawl4ai.deep_crawling"] = deep_crawling
    sys.modules["crawl4ai.deep_crawling.bfs_strategy"] = bfs_strategy


def pytest_addoption(parser):
    parser.addoption(
        "--run-real-web",
        action="store_true",
        default=False,
        help="Run real network crawler integration tests marked as real_web.",
    )


def pytest_configure(config):
    config.addinivalue_line(
        "markers", "real_web: marks tests that require real network and real crawl4ai"
    )

    use_real_crawl4ai = config.getoption("--run-real-web")
    if not use_real_crawl4ai:
        _install_fake_crawl4ai()
    repo_root = Path(__file__).resolve().parents[3]
    crawler_src = repo_root / "backend" / "crawler" / "src"
    if str(crawler_src) not in sys.path:
        sys.path.insert(0, str(crawler_src))


def pytest_collection_modifyitems(config, items):
    if config.getoption("--run-real-web"):
        return

    selected = []
    deselected = []
    for item in items:
        if item.get_closest_marker("real_web"):
            deselected.append(item)
        else:
            selected.append(item)

    if deselected:
        config.hook.pytest_deselected(items=deselected)
        items[:] = selected
