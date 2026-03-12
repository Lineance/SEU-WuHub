import logging
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml
from crawl4ai import AsyncWebCrawler, BrowserConfig, CacheMode, CrawlerRunConfig
from crawl4ai.deep_crawling.bfs_strategy import BFSDeepCrawlStrategy


class ArticleUrlCrawler:
    """Crawl one or more article URLs and return normalized result objects."""

    def __init__(
        self,
        config_dir: str | None = None,
        cache_base_directory: str | None = None,
    ) -> None:
        self.base_script_path = Path(__file__).resolve().parent
        if config_dir is None:
            self.config_dir = self.base_script_path.parent / "config_data"
        else:
            self.config_dir = Path(config_dir).resolve()

        self.cache_base_directory = (
            Path(cache_base_directory).resolve()
            if cache_base_directory
            else self.base_script_path.parent / "tmp" / "crawl4ai_cache"
        )
        self.cache_base_directory.mkdir(parents=True, exist_ok=True)

        self.browser_config: BrowserConfig | None = None
        self.crawler_config: CrawlerRunConfig | None = None
        self._crawler_instance: AsyncWebCrawler | None = None

        self.logger = self._setup_logger()

    async def __aenter__(self) -> "ArticleUrlCrawler":
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        await self.close()

    async def start(self) -> None:
        if self._crawler_instance is None:
            self._crawler_instance = AsyncWebCrawler(
                config=self.browser_config,
                base_directory=str(self.cache_base_directory),
            )
            await self._crawler_instance.start()
            self.logger.info("Crawl4AI article crawler started")

    async def close(self) -> None:
        if self._crawler_instance is not None:
            await self._crawler_instance.close()
            self._crawler_instance = None
            self.logger.info("Crawl4AI article crawler closed")

    def _setup_logger(self) -> logging.Logger:
        logger = logging.getLogger("article_url_crawler")
        if not logger.handlers:
            logger.setLevel(logging.INFO)
            fmt = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
            console_handler = logging.StreamHandler()
            console_handler.setFormatter(fmt)
            logger.addHandler(console_handler)
        return logger

    def _load_yaml_config(self, filepath: Path) -> dict[str, Any]:
        with open(filepath, encoding="utf-8") as f:
            return yaml.safe_load(f)

    def _create_crawler_config(self, config_data: dict[str, Any]) -> CrawlerRunConfig:
        config_data = dict(config_data)
        if "cache_mode" in config_data:
            cache_mode_str = config_data.pop("cache_mode")
            try:
                config_data["cache_mode"] = getattr(CacheMode, cache_mode_str)
            except AttributeError:
                self.logger.warning("Invalid cache mode: %s", cache_mode_str)

        return CrawlerRunConfig(**config_data)

    def _init_configs(self) -> None:
        browser_config_path = self.config_dir / "browser.yaml"
        crawler_config_path = self.config_dir / "crawler.yaml"

        if browser_config_path.exists():
            browser_data = self._load_yaml_config(browser_config_path)
            self.browser_config = BrowserConfig(**browser_data.get("browser", {}))
        else:
            self.browser_config = BrowserConfig()

        if crawler_config_path.exists():
            crawler_data = self._load_yaml_config(crawler_config_path)
            self.crawler_config = self._create_crawler_config(crawler_data.get("crawler", {}))
        else:
            self.crawler_config = CrawlerRunConfig()

    def load_website_config(self, website_name: str) -> dict[str, Any]:
        config_path = self.config_dir / "websites" / f"{website_name}.yaml"
        if not config_path.exists():
            raise FileNotFoundError(f"Website config not found: {config_path}")
        return self._load_yaml_config(config_path)

    def _merge_crawler_configs(
        self,
        base_config: CrawlerRunConfig,
        overrides: dict[str, Any],
    ) -> CrawlerRunConfig:
        merged_config = base_config.clone()
        deep_crawl_config = overrides.get("deep_crawl_strategy")

        for key, value in overrides.items():
            if key == "deep_crawl_strategy":
                continue
            if hasattr(merged_config, key):
                setattr(merged_config, key, value)

        if deep_crawl_config and isinstance(deep_crawl_config, dict):
            if deep_crawl_config.get("enabled", False):
                merged_config.deep_crawl_strategy = BFSDeepCrawlStrategy(
                    max_depth=deep_crawl_config.get("max_depth", 3),
                    max_pages=deep_crawl_config.get("max_pages", 100),
                    include_external=not deep_crawl_config.get("same_domain_only", True),
                )
            else:
                merged_config.deep_crawl_strategy = None

        return merged_config

    def load_config(
        self,
        target: str | list[str],
        is_website_config: bool = False,
        override_config: dict[str, Any] | None = None,
    ) -> tuple[list[str], CrawlerRunConfig, BrowserConfig]:
        self._init_configs()

        urls_to_crawl: list[str]
        run_config = self.crawler_config.clone() if self.crawler_config else CrawlerRunConfig()
        browser_config = self.browser_config.clone() if self.browser_config else BrowserConfig()

        if is_website_config:
            website_cfg = self.load_website_config(target).get("website", {})
            urls_to_crawl = website_cfg.get("start_urls", [])
            overrides = website_cfg.get("overrides", {})
            run_config = self._merge_crawler_configs(run_config, overrides.get("crawler", {}))
            for key, value in overrides.get("browser", {}).items():
                if hasattr(browser_config, key):
                    setattr(browser_config, key, value)
        else:
            urls_to_crawl = [target] if isinstance(target, str) else target
            if override_config:
                run_config = self._merge_crawler_configs(
                    run_config, override_config.get("crawler", {})
                )
                for key, value in override_config.get("browser", {}).items():
                    if hasattr(browser_config, key):
                        setattr(browser_config, key, value)

        return urls_to_crawl, run_config, browser_config

    async def crawl_article(
        self,
        url: str,
        run_config: CrawlerRunConfig,
    ) -> dict[str, Any]:
        if not self._crawler_instance:
            await self.start()

        res = await self._crawler_instance.arun(url=url, config=run_config)
        return self._format_result(res)

    async def crawl_articles(
        self,
        urls: list[str],
        run_config: CrawlerRunConfig,
    ) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        for url in urls:
            try:
                results.append(await self.crawl_article(url=url, run_config=run_config))
            except Exception as exc:
                self.logger.error("Failed to crawl article %s: %s", url, exc)
                results.append(
                    {
                        "success": False,
                        "url": url,
                        "error": str(exc),
                        "markdown": "",
                        "metadata": {
                            "crawled_at": datetime.now().isoformat(),
                            "word_count": 0,
                            "is_pdf": False,
                            "depth": 0,
                        },
                        "pdf_size": 0,
                    }
                )
        return results

    def _format_result(self, result: Any) -> dict[str, Any]:
        if isinstance(result, dict):
            defaults = {
                "success": False,
                "url": "",
                "title": "",
                "content": "",
                "markdown": "",
                "error": result.get("error", "Unknown internal error"),
                "metadata": {
                    "crawled_at": datetime.now().isoformat(),
                    "word_count": 0,
                    "is_pdf": False,
                    "depth": 0,
                },
                "pdf_size": 0,
            }
            for key, value in defaults.items():
                result.setdefault(key, value)
            return result

        markdown_content = ""
        if hasattr(result, "markdown_v2") and result.markdown_v2:
            markdown_content = getattr(result.markdown_v2, "raw_markdown", "") or ""
        elif hasattr(result, "markdown"):
            markdown_content = result.markdown or ""

        url = getattr(result, "url", "")
        success = getattr(result, "success", False)
        error_msg = getattr(result, "error_message", None)

        formatted = {
            "success": success,
            "url": url,
            "title": getattr(result, "title", "") or "",
            "content": getattr(result, "cleaned_html", ""),
            "markdown": markdown_content,
            "metadata": {
                "crawled_at": datetime.now().isoformat(),
                "word_count": getattr(result, "word_count", 0) or 0,
                "is_pdf": getattr(result, "pdf", None) is not None
                or (url and url.lower().endswith(".pdf")),
                "depth": getattr(result, "depth", 0) or 0,
            },
            "pdf_size": len(result.pdf) if getattr(result, "pdf", None) else 0,
        }

        if not success:
            formatted["error"] = error_msg or "Crawl failed without specific error message"

        return formatted
