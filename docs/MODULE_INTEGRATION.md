# SEU-WuHub 模块集成指南

本文档详细说明 SEU-WuHub 系统中各个模块的连接方式和集成操作流程。包含理论架构和实际操作指南，帮助开发者理解模块间的交互关系并正确配置和运行系统。

## 1. 模块概述

SEU-WuHub 采用分层架构设计，各模块职责明确，通过清晰的接口进行通信：

### 1.1 核心模块层次结构

```
┌─────────────────────────────────────────────────────────────┐
│                    前端层 (frontend/)                        │
│  • React + TypeScript 用户界面                               │
│  • API 客户端 (调用后端 REST API)                            │
│  • 流式通信 (SSE 实时推送)                                   │
└──────────────────────────────┬──────────────────────────────┘
                                │ HTTP/SSE
┌──────────────────────────────▼──────────────────────────────┐
│                    API 层 (backend/app/)                    │
│  • FastAPI REST 接口                                        │
│  • 请求验证和路由转发                                        │
│  • 服务编排和响应格式化                                      │
└──────────────────────────────┬──────────────────────────────┘
                                │ 服务调用
┌──────────────────────────────▼──────────────────────────────┐
│                应用服务层 (backend/app/services/)            │
│  • 业务逻辑编排                                             │
│  • Agent 服务调用                                           │
│  • 检索服务封装                                             │
└──────────────────────────────┬──────────────────────────────┘
                                │ 模块调用
┌─────────────┬────────────────┼────────────────┬─────────────┐
│             │                │                │             │
│  检索层     │    Agent层     │    数据层      │   爬虫层    │
│ (retrieval/)|   (agent/)     │    (data/)     │  (crawler/) │
│             │                │                │             │
└─────────────┴────────────────┴────────────────┴─────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                 LanceDB 存储层 (data/campus.lance)           │
│  • 统一向量存储                                             │
│  • 结构化元数据                                            │
│  • 全文索引和向量索引                                       │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 模块依赖关系

| 模块 | 依赖模块 | 提供接口 | 主要职责 |
|------|----------|----------|----------|
| **数据层** (`data/`) | `core/` | CRUD 操作、连接管理 | LanceDB 数据库访问 |
| **标签系统** (`ingestion/tag_*`) | `data/`, `core/` | 标签匹配、初始化 | 自动标签分配和管理 |
| **检索层** (`retrieval/`) | `data/` | 混合搜索、向量搜索 | 语义和关键词检索 |
| **Agent层** (`agent/`) | `retrieval/`, `llm/` | ReAct 决策、工具调用 | 智能问答决策引擎 |
| **爬虫层** (`crawler/`) | 无（独立） | 数据采集、增量更新 | 网站内容抓取 |
| **API层** (`app/`) | 所有业务层 | REST API、SSE 流式 | 请求处理和响应组装 |

### 1.3 Agent 模块接入现状（2026-03）

- 新增接口：`POST /api/v1/chat/stream`（SSE）
- 新增服务：`backend/app/services/agent_service.py`
- 新增模块：`backend/agent/`（core、tools、events、memory、config）
- 工具链路：
  - `search_keyword` -> `backend/retrieval/engine.py`
  - `sql_service` -> `backend/database/repository.py` + `backend/database/guard.py`
  - `web_url_fetch` -> 受限域名抓取（默认仅 `seu.edu.cn`）

当前调用路径：

`FastAPI chat router -> AgentService -> ReActAgent -> ToolRegistry -> retrieval/database/http fetch`

---

## 2. 模块启动顺序指南

### 2.1 完整系统启动流程

```
1. 数据库初始化
   ↓
2. 标签系统初始化
   ↓
3. 检索引擎初始化
   ↓
4. 后端 API 服务启动
   ↓
5. 前端应用启动
   ↓
6. 爬虫数据采集（可选）
```

### 2.2 分步启动指令

#### 步骤 1：数据库初始化
```bash
# 进入后端目录
cd backend

# 初始化 LanceDB 数据库
python -c "from backend.data.connection import init_database; init_database()"

# 验证数据库连接
python -c "from backend.data.connection import get_connection; print('数据库连接成功' if get_connection() else '连接失败')"
```

#### 步骤 2：标签系统初始化
```bash
# 从配置文件初始化标签系统
python -m backend.ingestion.tag_initializer --config ../config/tags.yaml

# 可选：显示统计信息
python -m backend.ingestion.tag_initializer --config ../config/tags.yaml --stats
```

#### 步骤 3：检索引擎初始化
```bash
# 创建向量索引和全文索引
python -c "
from backend.retrieval.store import create_store
store = create_store()
print('检索引擎初始化完成')
"

# 测试检索功能
python -c "
from backend.retrieval.engine import create_engine
engine = create_engine()
results = engine.search('测试', limit=1)
print(f'检索测试完成，找到 {len(results.get(\"results\", []))} 条结果')
"
```

#### 步骤 4：后端 API 服务启动
```bash
# 使用 uvicorn 启动 FastAPI
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000

# 或使用 Docker Compose
docker-compose up backend
```

#### 步骤 5：前端应用启动
```bash
# 进入前端目录
cd frontend

# 开发模式启动
npm run dev

# 或生产构建
npm run build && npm run preview

# 或使用 Docker Compose
docker-compose up frontend
```

#### 步骤 6：爬虫数据采集（可选）
```bash
# 采集教务处通知
cd backend
python -m crawler.src.list_to_articles_e2e --website jwc --max-pages 3 --output ../tmp/jwc_data.json

# 查看采集结果
python -c "
import json
with open('../tmp/jwc_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
print(f'采集到 {len(data.get(\"articles\", []))} 篇文章')
"
```

---

## 3. 模块间通信协议

### 3.1 数据层 → 检索层

**通信方式**：LanceDB 表直接访问

```python
# retrieval/engine.py 中访问数据层
from backend.data.connection import get_articles_table

class HybridRetriever:
    def __init__(self):
        # 直接获取 LanceDB 表
        self.table = get_articles_table()
    
    def search(self, query: str, limit: int = 10):
        # 使用 LanceDB 原生查询
        return self.table.search(query).limit(limit).to_list()
```

**数据格式**：
- 输入：查询字符串、过滤条件
- 输出：Article 记录列表（包含向量、元数据）

### 3.2 标签系统 → 数据层

**通信方式**：标签表 CRUD 操作

```python
# ingestion/tag_matcher.py 中访问标签数据
from backend.data.tag_repository import get_tag_repository

class TagMatcher:
    def __init__(self):
        self.tag_repo = get_tag_repository()
    
    def match_tags(self, text: str):
        # 获取所有标签进行匹配
        all_tags = self.tag_repo.get_all()
        # 计算相似度并返回匹配结果
        return self._calculate_similarity(text, all_tags)
```

**数据格式**：
- 输入：文本内容、相似度阈值
- 输出：匹配的标签ID和相似度分数

### 3.3 爬虫 → 摄取管道

**通信方式**：数据适配器接口

```python
# ingestion/adapters/crawler.py
class CrawlerAdapter:
    def adapt(self, crawler_data: dict) -> dict:
        """将爬虫数据转换为标准格式"""
        return {
            "title": crawler_data.get("title", ""),
            "content": crawler_data.get("content", ""),
            "url": crawler_data.get("url", ""),
            "source": crawler_data.get("metadata", {}).get("source", "unknown"),
            "metadata": crawler_data.get("metadata", {})
        }

# ingestion/pipeline.py
class IngestionPipeline:
    async def process_crawler_data(self, crawler_output: list[dict]):
        adapter = CrawlerAdapter()
        for raw_data in crawler_output:
            # 转换数据格式
            standard_data = adapter.adapt(raw_data)
            # 执行 ETL 流程
            await self.process(standard_data)
```

**数据格式**：
- 输入：爬虫原始数据（包含HTML、Markdown、元数据）
- 输出：标准化文档数据

### 3.4 前端 → 后端

**通信方式**：REST API + SSE

```typescript
// frontend/src/api/client.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
});

// REST API 调用
export const getArticles = async (params?: { limit?: number, source?: string }) => {
  return apiClient.get('/articles', { params });
};

// SSE 流式通信
export const streamChat = (query: string, onMessage: (data: any) => void) => {
  const eventSource = new EventSource(`/api/v1/chat/stream?q=${encodeURIComponent(query)}`);
  
  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    onMessage(data);
  };
  
  return () => eventSource.close();
};
```

**通信协议**：
- REST API：JSON over HTTP
- 流式通信：Server-Sent Events (SSE)

---

## 4. 爬虫模块集成指南

### 4.1 爬虫模块架构

```
crawler/
├── src/
│   ├── list_incremental_crawler.py    # 列表页增量抓取
│   ├── article_url_crawler.py         # 文章页抓取
│   ├── list_to_articles_e2e.py        # 端到端 CLI 入口
│   └── crawl4ai_config_utils.py       # Crawl4AI 配置归一化
├── config/websites/                   # 网站配置
│   ├── jwc.yaml                       # 教务处配置
│   └── [其他网站].yaml
└── adapters/                          # 输出适配器
    └── lance_adapter.py               # LanceDB 适配器
```

### 4.2 爬虫工作流程

#### 阶段 1：列表页增量发现
```python
# 使用 ListIncrementalCrawler 发现新文章 URL
from crawler.src.list_incremental_crawler import ListIncrementalCrawler

crawler = ListIncrementalCrawler()
new_urls = crawler.crawl_list_incremental(
    list_url="https://jwc.seu.edu.cn/jwxx/list.htm",
    max_pages=3,
    state_file_path="tmp/jwc_seen_urls.json"
)
print(f"发现 {len(new_urls)} 个新文章URL")
```

#### 阶段 2：文章页抓取与标准化
```python
# 使用 ArticleUrlCrawler 抓取文章内容
from crawler.src.article_url_crawler import ArticleUrlCrawler

crawler = ArticleUrlCrawler()
articles = crawler.crawl_articles(
    urls=new_urls,
    run_config={
        "css_selector": ".wp_articlecontent",
        "markdown_generator": {
            "type": "default",
            "content_source": "cleaned_html"
        }
    }
)
print(f"成功抓取 {len(articles)} 篇文章")
```

#### 阶段 3：数据导出与集成
```python
# 保存为 JSON 文件
import json
with open('output/articles.json', 'w', encoding='utf-8') as f:
    json.dump({"articles": articles}, f, ensure_ascii=False, indent=2)

# 或直接通过适配器写入 LanceDB
from crawler.adapters.lance_adapter import LanceAdapter
adapter = LanceAdapter()
adapter.save_articles(articles)
```

### 4.3 CLI 接口使用

#### 基本用法
```bash
# 使用网站配置采集（推荐）
cd backend
python -m crawler.src.list_to_articles_e2e --website jwc --max-pages 3 --output ../tmp/jwc_full_pull.json

# 直接指定列表 URL
python -m crawler.src.list_to_articles_e2e --list-url https://jwc.seu.edu.cn/jwxx/list.htm --max-pages 3 --output ../tmp/out.json
```

#### 常用参数
```bash
# 控制采集深度
--max-pages 5          # 列表翻页上限
--limit-per-page 20    # 每页文章数量限制

# URL 过滤
--include-pattern ".*通知.*"   # 包含特定关键词
--exclude-pattern ".*公示.*"   # 排除特定关键词

# 缓存控制
--cache-dir "tmp/crawl4ai_cache"  # 统一缓存目录
--article-crawler-overrides '{"cache_mode":"BYPASS"}'  # 绕过缓存

# 输出控制
--output "data/articles.json"      # 输出文件路径
--format json                      # 输出格式 (json/csv)
```

#### 高级配置覆盖
```bash
# 覆盖列表阶段配置
python -m crawler.src.list_to_articles_e2e --website jwc \
  --list-crawler-overrides '{"cache_mode":"ENABLED","check_cache_freshness":true}' \
  --output jwc_data.json

# 覆盖文章阶段配置
python -m crawler.src.list_to_articles_e2e --website jwc \
  --article-crawler-overrides '{"css_selector":".wp_articlecontent","markdown_generator":{"type":"default","content_filter":{"type":"pruning"}}}' \
  --output jwc_data.json

# 覆盖浏览器配置
python -m crawler.src.list_to_articles_e2e --website jwc \
  --browser-overrides '{"headless":false,"light_mode":true}' \
  --output jwc_data.json
```

### 4.4 网站配置接口

#### 配置文件结构 (`config/websites/jwc.yaml`)
```yaml
website:
  # 起始 URL 列表
  start_urls:
    - "https://jwc.seu.edu.cn/jwxx/list.htm"
    - "https://jwc.seu.edu.cn/tzgg/list.htm"
  
  # 列表页增量配置
  list_incremental:
    max_pages: 31                    # 最大翻页数
    state_file: "tmp/jwc_seen_urls.json"  # 增量状态文件
    cache_base_directory: "tmp/crawl4ai_jwc_cache"  # 缓存目录
    include_patterns:                # URL 包含模式
      - "jwxx"
      - "tzgg"
    exclude_patterns: []             # URL 排除模式
  
  # 配置覆盖
  overrides:
    # 列表爬虫配置
    list_crawler:
      cache_mode: "ENABLED"
      check_cache_freshness: true
      request_timeout: 30000
      max_retries: 3
    
    # 文章爬虫配置
    article_crawler:
      cache_mode: "ENABLED"
      css_selector: ".wp_articlecontent, .Article_Content"
      target_elements: ["main", "article", ".content"]
      markdown_generator:
        type: "default"
        content_source: "cleaned_html"
        options:
          ignore_links: false
          ignore_images: true
        content_filter:
          type: "pruning"  # pruning|bm25|llm
          params:
            min_sentence_length: 10
            max_sentence_length: 500
    
    # 浏览器配置
    browser:
      headless: true
      light_mode: true
      viewport: {width: 1920, height: 1080}
      user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
```

#### 配置说明
1. **列表爬虫配置**：控制 URL 发现阶段的参数
2. **文章爬虫配置**：控制内容提取和处理的参数
3. **浏览器配置**：控制 Playwright 浏览器的行为
4. **缓存配置**：多级缓存策略，提高采集效率

### 4.5 缓存与状态管理

#### 增量状态文件
```python
# 状态文件结构
{
  "https://jwc.seu.edu.cn/jwxx/list.htm": {
    "last_crawl_time": "2026-03-19T10:30:00Z",
    "seen_urls": [
      "https://jwc.seu.edu.cn/2026/0319/c12345a123456/page.htm",
      "https://jwc.seu.edu.cn/2026/0318/c12345a123457/page.htm"
    ],
    "total_discovered": 150,
    "last_page_crawled": 5
  }
}
```

#### Crawl4AI 缓存目录
```
tmp/crawl4ai_cache/
├── list_cache/          # 列表页缓存
│   ├── url_hash1.json
│   └── url_hash2.json
├── article_cache/       # 文章页缓存
│   ├── url_hash3.html
│   └── url_hash4.html
└── metadata/           # 元数据缓存
    ├── cache_index.json
    └── freshness_check.json
```

#### 缓存管理最佳实践
```bash
# 1. 统一指定缓存目录
python -m crawler.src.list_to_articles_e2e --website jwc --cache-dir "tmp/crawl4ai_cache"

# 2. 定期清理旧缓存
find tmp/crawl4ai_cache -type f -mtime +7 -delete

# 3. 调试缓存问题
python -c "
from crawler.src.article_url_crawler import ArticleUrlCrawler
crawler = ArticleUrlCrawler()
result = crawler.crawl_article('https://jwc.seu.edu.cn/some-page', 
                               {'cache_mode': 'ENABLED'})
print(f'缓存状态: {result.get(\"metadata\", {}).get(\"cache_status\", \"unknown\")}')
"
```

### 4.6 常见问题与解决方案

#### 问题 1：`incremental_urls=0` 但日志显示 `discovered>0`
**原因**：状态文件中已存在这些 URL（正常增量行为）

**解决方案**：
```bash
# 查看状态文件
cat tmp/jwc_seen_urls.json | python -m json.tool

# 重置状态文件（谨慎操作）
rm tmp/jwc_seen_urls.json

# 或手动删除特定 URL
python -c "
import json
with open('tmp/jwc_seen_urls.json', 'r') as f:
    state = json.load(f)
# 删除特定 URL 的记录
# 然后重新运行爬虫
"
```

#### 问题 2：Markdown 质量忽好忽坏
**原因**：命中旧缓存，HTML 结构变化

**解决方案**：
```bash
# 临时绕过缓存
python -m crawler.src.list_to_articles_e2e --website jwc \
  --article-crawler-overrides '{"cache_mode":"BYPASS"}' \
  --output fresh_data.json

# 或清理特定缓存
rm -rf tmp/crawl4ai_cache/article_cache/*

# 检查缓存状态
python -c "
result = crawler.crawl_article(url, run_config)
print(f'缓存状态: {result[\"metadata\"][\"cache_status\"]}')
"
```

#### 问题 3：想要更干净的正文
**解决方案**：
```yaml
# 更新网站配置
article_crawler:
  css_selector: ".wp_articlecontent"  # 更精确的选择器
  target_elements: ["main", "article", ".content"]
  markdown_generator:
    content_filter:
      type: "pruning"
      params:
        min_sentence_length: 10
        max_sentence_length: 500
        remove_repetitive: true
```

#### 问题 4：爬虫速度慢
**解决方案**：
```bash
# 1. 启用缓存
python -m crawler.src.list_to_articles_e2e --website jwc \
  --list-crawler-overrides '{"cache_mode":"ENABLED"}' \
  --article-crawler-overrides '{"cache_mode":"ENABLED"}'

# 2. 减少翻页数
--max-pages 2

# 3. 使用无头浏览器优化
--browser-overrides '{"headless":true,"light_mode":true}'
```

### 4.7 集成测试

#### 单元测试
```bash
# 运行爬虫模块测试
cd backend
pytest crawler/test/ -v

# 测试列表增量爬虫
pytest crawler/test/test_list_incremental_crawler.py

# 测试端到端流程
pytest crawler/test/test_list_to_articles_e2e.py
```

#### 集成测试
```bash
# 真实网页集成测试（需要网络）
pytest crawler/test/test_real_web_integration.py -v

# 测试配置加载
python -c "
from crawler.src.crawl4ai_config_utils import load_config
config = load_config('jwc')
print(f'配置加载成功: {config[\"website\"][\"start_urls\"][0]}')
"
```

#### 手动测试
```bash
# 1. 测试列表页发现
python -c "
from crawler.src.list_incremental_crawler import ListIncrementalCrawler
crawler = ListIncrementalCrawler()
urls = crawler.crawl_list_incremental('https://jwc.seu.edu.cn/jwxx/list.htm', max_pages=1)
print(f'发现 {len(urls)} 个URL: {urls[:3] if urls else \"无\"}')
"

# 2. 测试文章抓取
python -c "
from crawler.src.article_url_crawler import ArticleUrlCrawler
crawler = ArticleUrlCrawler()
if urls:
    article = crawler.crawl_article(urls[0], {'css_selector': '.wp_articlecontent'})
    print(f'标题: {article.get(\"title\", \"无\")}')
    print(f'内容长度: {len(article.get(\"content\", \"\"))}')
"
```

---

## 5. 配置依赖关系管理

### 5.1 配置文件层级

```
config/
├── app.yaml              # 应用全局配置
├── tags.yaml             # 标签系统配置
└── websites/             # 爬虫网站配置
    ├── jwc.yaml          # 教务处
    ├── lib.yaml          # 图书馆
    └── schema.yaml       # 配置校验规则
```

### 5.2 环境变量设置

```bash
# 基础环境变量
export PYTHONPATH="$PYTHONPATH:$(pwd)/backend"
export LANCE_DB_PATH="$(pwd)/data/campus.lance"
export LOG_LEVEL="INFO"

# 开发环境
export DEVELOPMENT=true
export API_HOST="0.0.0.0"
export API_PORT=8000

# 生产环境
export PRODUCTION=true
export DATABASE_BACKUP_DIR="/backup"
export MAX_WORKERS=4
```

### 5.3 配置加载顺序

```python
# backend/app/core/config.py
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # 1. 环境变量（最高优先级）
    database_path: str = "data/campus.lance"
    log_level: str = "INFO"
    
    # 2. 配置文件（次优先级）
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
    
    # 3. 默认值（最低优先级）
    api_host: str = "0.0.0.0"
    api_port: int = 8000
```

---

## 6. 集成测试指南

### 6.1 端到端测试流程

#### 测试 1：完整数据流测试
```bash
#!/bin/bash
# tests/integration/test_full_data_flow.sh

echo "1. 初始化数据库..."
python -c "from backend.data.connection import init_database; init_database()"

echo "2. 初始化标签系统..."
python -m backend.ingestion.tag_initializer --config config/tags.yaml

echo "3. 模拟爬虫数据..."
python tests/integration/mock_crawler_data.py

echo "4. 运行 ETL 管道..."
python -c "
from backend.ingestion.pipeline import create_pipeline
import json
with open('tests/data/mock_articles.json', 'r') as f:
    documents = json.load(f)
pipeline = create_pipeline()
result = pipeline.process_batch(documents)
print(f'ETL 结果: {result.summary()}')
"

echo "5. 测试检索功能..."
python -c "
from backend.retrieval.engine import create_engine
engine = create_engine()
results = engine.search('测试文章', limit=5)
print(f'检索到 {len(results.get(\"results\", []))} 条结果')
"

echo "6. 测试 API 接口..."
curl -s "http://localhost:8000/api/v1/articles?limit=1" | python -m json.tool
```

#### 测试 2：模块连接测试
```python
# tests/integration/test_module_connections.py
import unittest
from backend.data.connection import get_connection
from backend.data.tag_repository import get_tag_repository
from backend.ingestion.tag_matcher import TagMatcher
from backend.retrieval.engine import create_engine

class TestModuleConnections(unittest.TestCase):
    def test_database_connection(self):
        """测试数据库连接"""
        conn = get_connection()
        self.assertIsNotNone(conn)
    
    def test_tag_system_integration(self):
        """测试标签系统集成"""
        tag_repo = get_tag_repository()
        tags = tag_repo.get_all()
        self.assertIsInstance(tags, list)
    
    def test_retrieval_integration(self):
        """测试检索引擎集成"""
        engine = create_engine()
        results = engine.search("测试", limit=1)
        self.assertIn("results", results)
    
    def test_pipeline_integration(self):
        """测试数据管道集成"""
        from backend.ingestion.pipeline import create_pipeline
        pipeline = create_pipeline()
        self.assertIsNotNone(pipeline)
```

### 6.2 故障排查方法

#### 查看日志
```bash
# 查看应用日志
tail -f logs/app.log

# 查看错误日志
grep -i "error" logs/app.log

# 查看爬虫日志
tail -f logs/crawler.log

# 查看数据库操作日志
python -c "
import logging
logging.basicConfig(level=logging.DEBUG)
from backend.data.connection import get_connection
conn = get_connection()
print('数据库连接调试信息已启用')
"
```

#### 检查系统状态
```bash
# 检查数据库状态
python -c "
from backend.data.connection import get_articles_table
table = get_articles_table()
print(f'文章表记录数: {table.count_rows()}')
"

# 检查标签系统状态
python -c "
from backend.data.tag_repository import get_tag_repository
repo = get_tag_repository()
print(f'标签数量: {repo.count()}')
"

# 检查检索引擎状态
python -c "
from backend.retrieval.engine import create_engine
engine = create_engine()
print('检索引擎状态: 正常' if engine else '异常')
"
```

#### 性能监控
```bash
# 监控 API 响应时间
curl -w "\n时间统计:\n总时间: %{time_total}s\nDNS解析: %{time_namelookup}s\n连接建立: %{time_connect}s\nSSL握手: %{time_appconnect}s\n准备传输: %{time_pretransfer}s\n开始传输: %{time_starttransfer}s\n" \
  -o /dev/null -s "http://localhost:8000/api/health"

# 监控内存使用
python -c "
import psutil
import os
process = psutil.Process(os.getpid())
print(f'内存使用: {process.memory_info().rss / 1024 / 1024:.2f} MB')
print(f'CPU使用: {process.cpu_percent()}%')
"
```

---

## 7. 部署集成检查清单

### 7.1 预部署检查
- [ ] 数据库初始化完成
- [ ] 标签系统初始化完成
- [ ] 配置文件正确设置
- [ ] 环境变量配置完成
- [ ] 依赖包安装完成

### 7.2 服务启动检查
- [ ] 后端 API 服务启动成功
- [ ] 前端应用构建完成
- [ ] Nginx 配置正确
- [ ] 数据库连接正常
- [ ] 检索引擎初始化完成

### 7.3 功能验证检查
- [ ] API 接口响应正常
- [ ] 检索功能正常工作
- [ ] 标签匹配功能正常
- [ ] 数据导入功能正常
- [ ] 流式通信功能正常

### 7.4 性能监控检查
- [ ] 日志系统正常工作
- [ ] 错误监控配置完成
- [ ] 性能指标收集正常
- [ ] 备份机制配置完成
- [ ] 告警系统配置完成

---

## 8. 常见集成问题与解决方案

### 问题 1：数据库连接失败
**症状**：应用启动时报数据库连接错误

**解决方案**：
```bash
# 1. 检查数据库文件权限
ls -la data/campus.lance/

# 2. 检查 LanceDB 版本兼容性
python -c "import lancedb; print(f'LanceDB 版本: {lancedb.__version__}')"

# 3. 重新初始化数据库
rm -rf data/campus.lance/
python -c "from backend.data.connection import init_database; init_database()"
```

### 问题 2：标签匹配不准确
**症状**：文章标签分配不合理

**解决方案**：
```bash
# 1. 重新初始化标签向量
python -m backend.ingestion.tag_initializer --config config/tags.yaml --clear

# 2. 调整匹配阈值
# 修改 config/tags.yaml 中的 matching.strict_threshold

# 3. 测试标签匹配
python -c "
from backend.ingestion.tag_matcher import TagMatcher
matcher = TagMatcher()
test_text = '这是一个学术讲座通知'
matches = matcher.match_tags(test_text)
print('测试结果:', matches)
"
```

### 问题 3：检索性能差
**症状**：搜索响应时间过长

**解决方案**：
```bash
# 1. 优化索引配置
python -c "
from backend.retrieval.store import create_store
store = create_store()
store.optimize_indices()
print('索引优化完成')
"

# 2. 检查向量索引
python -c "
from backend.data.connection import get_articles_table
table = get_articles_table()
print('向量索引状态:', table.list_indices())
"

# 3. 清理缓存
rm -rf data/campus.lance/_indices/.cache
```

### 问题 4：爬虫集成失败
**症状**：爬虫数据无法正确导入

**解决方案**：
```bash
# 1. 检查爬虫输出格式
python -c "
import json
with open('tmp/jwc_data.json', 'r') as f:
    data = json.load(f)
print('文章数量:', len(data.get('articles', [])))
print('第一篇标题:', data.get('articles', [{}])[0].get('title', '无'))
"

# 2. 测试数据适配器
python -c "
from backend.ingestion.adapters.crawler import CrawlerAdapter
adapter = CrawlerAdapter()
# 使用示例数据测试
"

# 3. 检查 ETL 管道日志
tail -f logs/ingestion.log
```

---

## 9. 扩展与定制指南

### 9.1 添加新数据源
1. 在 `config/websites/` 创建新的 YAML 配置文件
2. 配置爬虫规则和选择器
3. 测试数据采集流程
4. 集成到数据管道

### 9.2 定制标签系统
1. 修改 `config/tags.yaml` 添加新标签
2. 运行标签初始化脚本
3. 调整匹配算法参数
4. 验证标签匹配效果

### 9.3 扩展检索功能
1. 实现新的检索算法
2. 集成到 `retrieval/engine.py`
3. 添加相应的 API 端点
4. 更新前端界面支持

### 9.4 集成外部服务
1. 定义清晰的接口规范
2. 实现适配器层
3. 添加配置选项
4. 编写集成测试

---

## 10. 维护与升级

### 10.1 日常维护任务
- 监控系统日志，及时处理错误
- 定期备份数据库文件
- 清理临时文件和缓存
- 更新依赖包版本

### 10.2 版本升级流程
1. 备份当前数据和配置
2. 阅读版本升级说明
3. 按顺序更新各个模块
4. 运行集成测试验证
5. 监控升级后系统状态

### 10.3 故障恢复流程
1. 识别问题根源
2. 回滚到稳定版本（如有必要）
3. 恢复数据备份
4. 重新启动服务
5. 验证系统功能

---

*本文档最后更新：2026年3月19日*

> **提示**：本文档内容会根据系统版本更新而调整，请定期查看最新版本。如有问题或建议，请提交到项目 Issues 页面。