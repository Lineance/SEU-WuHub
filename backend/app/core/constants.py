"""
System Constants - Path definitions and version info

Responsibilities:
    - Data directory paths
    - API version strings
    - Default pagination limits
"""

# API Version
API_VERSION = "v1"

# Pagination
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100

# Article Sources
SOURCE_ACADEMIC = "教务处"
SOURCE_LIBRARY = "图书馆"
SOURCE_ALL = "全部"

# Date Format
DATE_FORMAT = "%Y-%m-%d"

# Response Messages
MSG_ARTICLE_NOT_FOUND = "文章不存在"
MSG_SEARCH_SUCCESS = "搜索成功"
MSG_SEARCH_FAILED = "搜索失败"
MSG_LOAD_SUCCESS = "加载成功"
MSG_LOAD_FAILED = "加载失败"
