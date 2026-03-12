import argparse
import asyncio
import json
import os
import time

from crawl4ai import CacheMode

try:
    from .article_url_crawler import ArticleUrlCrawler
    from .list_incremental_crawler import ListIncrementalCrawler
except ImportError:
    from article_url_crawler import ArticleUrlCrawler
    from list_incremental_crawler import ListIncrementalCrawler


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="List URL incremental crawler e2e")
    source_group = parser.add_mutually_exclusive_group(required=True)
    source_group.add_argument(
        "--list-url", help="List page url, e.g. https://jwc.seu.edu.cn/jwxx/list.htm"
    )
    source_group.add_argument(
        "--website", help="Website config name under config/websites, e.g. jwc"
    )
    parser.add_argument("--config-dir", default=None, help="Crawler config directory")
    parser.add_argument("--max-pages", type=int, default=31, help="Max list pages")
    parser.add_argument("--state-file", default=None, help="Incremental state file path")
    parser.add_argument("--cache-dir", default=None, help="Crawl4ai cache base directory")
    parser.add_argument("--output", default=None, help="Optional output json file")
    parser.add_argument(
        "--include-pattern",
        action="append",
        default=None,
        help="Regex include pattern for article urls (repeatable)",
    )
    parser.add_argument(
        "--exclude-pattern",
        action="append",
        default=None,
        help="Regex exclude pattern for article urls (repeatable)",
    )
    return parser.parse_args()


async def run_e2e(args: argparse.Namespace) -> dict:
    start = time.time()

    source_mode = "website" if args.website else "list_url"
    lists_summary: list[dict] = []
    website_overrides: dict = {}

    async with ListIncrementalCrawler(
        config_dir=args.config_dir,
        cache_base_directory=args.cache_dir,
        state_file=args.state_file,
    ) as list_crawler:
        if args.website:
            batch_result = await list_crawler.crawl_website_incremental(
                website_name=args.website,
                max_pages=args.max_pages,
                include_patterns=args.include_pattern,
                exclude_patterns=args.exclude_pattern,
            )
            incremental_urls = batch_result["incremental_urls"]
            lists_summary = batch_result["lists"]
            website_overrides = batch_result.get("overrides", {})
        else:
            incremental_urls = await list_crawler.crawl_list_incremental(
                list_url=args.list_url,
                max_pages=args.max_pages,
                include_patterns=args.include_pattern,
                exclude_patterns=args.exclude_pattern,
            )
            lists_summary = [
                {
                    "list_url": args.list_url,
                    "incremental_count": len(incremental_urls),
                    "state_file": args.state_file,
                    "incremental_urls": incremental_urls,
                }
            ]

    async with ArticleUrlCrawler(
        config_dir=args.config_dir,
        cache_base_directory=args.cache_dir,
    ) as article_crawler:
        _, run_config, _ = article_crawler.load_config(
            target=incremental_urls,
            override_config=website_overrides if args.website else None,
        )
        run_config.cache_mode = CacheMode.ENABLED
        run_config.check_cache_freshness = True
        results = await article_crawler.crawl_articles(incremental_urls, run_config=run_config)

    success_count = sum(1 for item in results if item.get("success"))
    failed_count = len(results) - success_count

    summary = {
        "source_mode": source_mode,
        "website": args.website,
        "list_url": args.list_url,
        "lists": lists_summary,
        "incremental_url_count": len(incremental_urls),
        "article_success_count": success_count,
        "article_failed_count": failed_count,
        "elapsed_seconds": round(time.time() - start, 2),
        "results": results,
    }

    return summary


def main() -> None:
    args = parse_args()
    summary = asyncio.run(run_e2e(args))

    if args.output:
        output_path = os.path.abspath(args.output)
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        payload = json.dumps(summary, ensure_ascii=False, indent=2)
        _write_output(output_path, payload)

    print(
        "e2e done | incremental_urls={incremental} | success={success} | failed={failed} | elapsed={elapsed}s".format(
            incremental=summary["incremental_url_count"],
            success=summary["article_success_count"],
            failed=summary["article_failed_count"],
            elapsed=summary["elapsed_seconds"],
        )
    )


if __name__ == "__main__":
    main()


def _write_output(path: str, payload: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        f.write(payload)
