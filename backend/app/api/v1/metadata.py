"""
Metadata API Router

提供元数据相关的 API 接口，包括分类、标签、来源站点和精选导航。
"""

import logging
from pathlib import Path
from typing import Any

import yaml
from fastapi import APIRouter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/metadata", tags=["metadata"])

CONFIG_DIR = Path(__file__).resolve().parents[4] / "config"
TAGS_FILE = CONFIG_DIR / "tags.yaml"
WEBSITES_DIR = CONFIG_DIR / "websites"
NAVIGATION_FILE = CONFIG_DIR / "navigation.yaml"


def load_yaml_file(file_path: Path) -> dict[str, Any] | None:
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)
    except FileNotFoundError:
        logger.warning(f"YAML file not found: {file_path}")
        return None
    except yaml.YAMLError as e:
        logger.error(f"YAML parsing error in {file_path}: {e}")
        return None


def get_categories(tags_data: dict[str, Any]) -> list[dict[str, Any]]:
    categories = tags_data.get("categories", {})
    result = []
    for key, value in categories.items():
        if isinstance(value, dict):
            result.append({
                "id": key,
                "name": value.get("name", key),
                "description": value.get("description", "")
            })
    return result


def get_tags_by_category(tags_data: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    tags_by_category: dict[str, list[dict[str, Any]]] = {}
    
    tags = tags_data.get("tags", [])
    for tag in tags:
        if isinstance(tag, dict):
            category = tag.get("category", "general")
            if category not in tags_by_category:
                tags_by_category[category] = []
            tags_by_category[category].append({
                "id": tag.get("id", ""),
                "name": tag.get("name", ""),
                "description": tag.get("description", ""),
                "priority": tag.get("priority", 2)
            })
    
    manual_tags = tags_data.get("manual_tags", [])
    for tag in manual_tags:
        if isinstance(tag, dict):
            category = "special"
            if category not in tags_by_category:
                tags_by_category[category] = []
            tags_by_category[category].append({
                "id": tag.get("id", ""),
                "name": tag.get("name", ""),
                "description": tag.get("description", ""),
                "priority": tag.get("priority", 0),
                "is_manual": True
            })
    
    return tags_by_category


def get_website_sources() -> list[str]:
    sources = []
    
    if not WEBSITES_DIR.exists():
        logger.warning(f"Websites directory not found: {WEBSITES_DIR}")
        return sources
    
    for yaml_file in WEBSITES_DIR.glob("*.yaml"):
        data = load_yaml_file(yaml_file)
        if data and "website" in data:
            website = data["website"]
            if isinstance(website, dict) and "name" in website:
                name = website["name"]
                if name and name not in sources:
                    sources.append(name)
    
    return sorted(sources)


def get_navigation_items() -> list[dict[str, Any]]:
    nav_data = load_yaml_file(NAVIGATION_FILE)
    
    if nav_data is None:
        return []
    
    nav_items = nav_data.get("nav_items", [])
    if not isinstance(nav_items, list):
        logger.warning("navigation.yaml: nav_items is not a list")
        return []
    
    result = []
    for item in nav_items:
        if isinstance(item, dict):
            result.append({
                "id": item.get("id", ""),
                "name": item.get("name", ""),
                "icon": item.get("icon", ""),
                "type": item.get("type", "search")
            })
    
    return result


@router.get("")
async def get_metadata():
    tags_data = load_yaml_file(TAGS_FILE)
    
    if tags_data is None:
        tags_data = {}
    
    categories = get_categories(tags_data)
    tags_by_category = get_tags_by_category(tags_data)
    sources = get_website_sources()
    navigation = get_navigation_items()
    
    return {
        "categories": categories,
        "tags": tags_by_category,
        "sources": sources,
        "navigation": navigation
    }
