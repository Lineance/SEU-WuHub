# 爬虫模块说明

## 概述

爬虫模块 (`backend/crawler/`) 负责从各网站采集文章内容，基于 Crawl4AI 实现。

## 目录结构

```
backend/crawler/
├── src/
│   ├── article_url_crawler.py    # 单文章爬虫
│   ├── list_incremental_crawler.py # 列表增量爬虫
│   ├── list_to_articles_e2e.py   # 端到端处理
│   └── crawl4ai_config_utils.py  # 配置工具
├── config_data/                  # 网站配置数据
└── tmp/                          # 临时文件（URL 去重状态）
```

## 核心组件

### ArticleUrlCrawler

单文章爬虫，用于爬取单个页面的完整内容。

```python
from backend.crawler.src.article_url_crawler import ArticleUrlCrawler

crawler = ArticleUrlCrawler()
result = crawler.crawl("https://jwc.seu.edu.cn/xxx.html")
# result.content_markdown  # Markdown 内容
# result.title             # 标题
# result.publish_date      # 发布日期
```

### ListIncrementalCrawler

列表增量爬虫，用于发现新增文章。

```python
from backend.crawler.src.list_incremental_crawler import ListIncrementalCrawler

crawler = ListIncrementalCrawler(config_path="config/websites/jwc.yaml")
new_urls = crawler.crawl()
# 返回新发现的 URL 列表
```

### ListToArticlesE2E

端到端处理，爬取列表页并处理所有新文章。

```python
from backend.crawler.src.list_to_articles_e2e import process_news_site

process_news_site(config_path="config/websites/jwc.yaml")
```

## 网站配置

配置文件位于 `config/websites/` 目录，使用 YAML 格式：

```yaml
website:
  name: "SEU JWC"
  base_url: "https://jwc.seu.edu.cn"
  start_urls:
    - "https://jwc.seu.edu.cn/jwxx/list.htm"
    - "https://jwc.seu.edu.cn/zxdt/list.htm"

list_incremental:
  enabled: true
  max_pages: 31
  state_file: "tmp/jwc_seen_urls.json"

overrides:
  article_crawler:
    target_elements:
      - ".Article_Title"
      - ".Article_PublishDate"
      - ".Article_Content"
      - ".wp_articlecontent"
```

## 使用流程

```
1. 配置网站规则 (config/websites/<name>.yaml)
       ↓
2. 运行 ListIncrementalCrawler 发现新 URL
       ↓
3. 对每个新 URL 运行 ArticleUrlCrawler
       ↓
4. 提取内容 → 传入 IngestionPipeline
       ↓
5. ETL 处理 → 写入 LanceDB
```

## 增量爬取

增量爬取通过状态文件实现 URL 去重：

```python
import json

state_file = "tmp/jwc_seen_urls.json"
seen_urls = json.load(open(state_file)) if os.path.exists(state_file) else set()
# 爬取后更新状态
json.dump(seen_urls, open(state_file, "w"))
```

## 目标元素选择器

爬虫支持多种 CSS 选择器定位内容：

| 选择器 | 说明 |
|--------|------|
| `.Article_Title` | 文章标题 |
| `.Article_PublishDate` | 发布日期 |
| `.Article_Content` | 正文内容 |
| `.wp_articlecontent` | WordPress 内容 |

## 依赖服务

- **Crawl4AI**: 网页爬取和内容提取
- **BeautifulSoup4**: HTML 解析
- **Playwright**: 浏览器自动化（可选，用于 JS 渲染页面）
