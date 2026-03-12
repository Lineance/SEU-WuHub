import logging
from typing import Any

from crawl4ai import CacheMode, LLMConfig
from crawl4ai.content_filter_strategy import (
    BM25ContentFilter,
    LLMContentFilter,
    PruningContentFilter,
)
from crawl4ai.markdown_generation_strategy import DefaultMarkdownGenerator


def normalize_cache_mode(value: Any, logger: logging.Logger) -> Any:
    if not isinstance(value, str):
        return value

    key = value.upper()
    if hasattr(CacheMode, key):
        return getattr(CacheMode, key)

    logger.warning("Invalid cache_mode override: %s", value)
    return value


def build_content_filter(config: Any, logger: logging.Logger) -> Any:
    if not isinstance(config, dict):
        return config

    filter_type = str(config.get("type", "")).strip().lower()
    params = dict(config.get("params", {}))

    if filter_type in {"", "none"}:
        return None
    if filter_type == "pruning":
        return PruningContentFilter(**params)
    if filter_type == "bm25":
        return BM25ContentFilter(**params)
    if filter_type == "llm":
        llm_cfg = params.pop("llm_config", None)
        if isinstance(llm_cfg, dict):
            params["llm_config"] = LLMConfig(**llm_cfg)
        return LLMContentFilter(**params)

    logger.warning("Unsupported content_filter type: %s", filter_type)
    return None


def build_markdown_generator(config: Any, logger: logging.Logger) -> Any:
    if not isinstance(config, dict):
        return config

    generator_type = str(config.get("type", "default")).strip().lower()
    if generator_type not in {"default", "defaultmarkdowngenerator"}:
        logger.warning("Unsupported markdown_generator type: %s", generator_type)
        return None

    kwargs: dict[str, Any] = {}
    if "content_source" in config:
        kwargs["content_source"] = config["content_source"]
    if isinstance(config.get("options"), dict):
        kwargs["options"] = config["options"]
    if "content_filter" in config:
        kwargs["content_filter"] = build_content_filter(config["content_filter"], logger)

    return DefaultMarkdownGenerator(**kwargs)


def normalize_crawler_overrides(
    overrides: dict[str, Any], logger: logging.Logger
) -> dict[str, Any]:
    normalized: dict[str, Any] = {}
    for key, value in overrides.items():
        if key == "cache_mode":
            normalized[key] = normalize_cache_mode(value, logger)
            continue
        if key == "markdown_generator":
            normalized[key] = build_markdown_generator(value, logger)
            continue

        normalized[key] = value

    return normalized
