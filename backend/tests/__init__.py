"""
Admin Module - 管理员交互模块

提供命令行界面用于:
- 爬取网站数据
- 查询文章
- 查看统计信息

Usage:
    >>> from backend.admin import AdminCLI
    >>> cli = AdminCLI()
    >>> cli.run()
"""

from .cli import AdminCLI

__all__ = ["AdminCLI"]
