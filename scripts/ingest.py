#!/usr/bin/env python
"""Ingest crawled articles into LanceDB"""
import json
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(project_root))

from backend.ingestion import create_pipeline  # noqa: E402
from backend.ingestion.adapters.crawler import CrawlerAdapter  # noqa: E402


def get_article_count(json_file: str) -> int:
    """Get article count from crawl output JSON"""
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data.get('article_success_count', 0)


def ingest_crawl_output(json_file: str) -> int:
    """Ingest articles from crawl output JSON, return number ingested"""
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    results = data.get('results', [])
    # Filter successful results with markdown content
    valid_docs = [
        r for r in results
        if r.get('success') and r.get('markdown')
    ]

    if not valid_docs:
        return 0

    # Convert using CrawlerAdapter to generate news_id and map fields
    adapter = CrawlerAdapter()
    converted = adapter.convert_batch(valid_docs)
    converted_docs = [c for c in converted if c is not None]

    if not converted_docs:
        return 0

    pipeline = create_pipeline()
    result = pipeline.process_batch(converted_docs)
    success = sum(1 for r in result.results if r.status == 'success')
    return success


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python ingest.py [--count] <crawl_output.json>")
        sys.exit(1)

    if sys.argv[1] == '--count':
        json_file = sys.argv[2]
        count = get_article_count(json_file)
        print(count)
    else:
        json_file = sys.argv[1]
        count = get_article_count(json_file)
        print(f"Article count: {count}")

        if count > 0:
            ingested = ingest_crawl_output(json_file)
            print(f"Ingested: {ingested}")
        else:
            print("No articles to ingest")