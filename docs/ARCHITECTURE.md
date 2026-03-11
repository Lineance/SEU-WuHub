# SEU-WuHub 架构文档

## 1. 项目概述

### 1.1 项目目标
构建面向高校师生的校园信息智能问答平台，整合教务处、图书馆等多部门通知公告，通过 RAG（检索增强生成）技术提供自然语言问答服务。

**核心功能**：
- 多源信息采集（官网爬虫 + 文件导入）
- 智能问答（基于大模型的 RAG 对话）
- 信息聚合（最近通知、分类浏览）
- 管理后台（爬虫监控、数据看板）

### 1.2 约束条件与关键设计哲学

| 维度 | 约束/策略 | 设计响应 |
|------|-----------|----------|
| **交付周期** | 4周（1个月） | Week 1 接口冻结，单体优先，拒绝微服务 |
| **部署方式** | 单机容器化（轻量级，无K8s） | Docker Compose 单文件启动，嵌入式存储 |
| **预算限制** | 云服务器成本 < ¥1500/年 | 纯嵌入式架构（LanceDB），零外部服务依赖 |
| **安全模型** | 公网只读，写入本地维护 | Nginx 限制 `GET/HEAD/OPTIONS`，SSH 本地执行更新 |

### 1.3 核心设计目标
1. **单一事实源**：LanceDB 同时存储结构化元数据、向量嵌入、全文索引，消除双写一致性风险
2. **零服务依赖**：纯嵌入式架构，无 Redis/Chroma/Postgres 常驻进程，单机 `docker-compose up` 即运行
3. **配置驱动爬虫**：新增数据源仅需修改 YAML，无需改代码发版
4. **流式响应**：SSE 实时推送，支持大模型打字机效果

---

## 2. 技术路线选型

### 2.1 核心技术栈

| 层级       | 选型                           | 版本                      | 选型理由与关键更新                                                                                          |
| -------- | ---------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------- |
| **前端**   | React 19 + TypeScript        | **^19.2.4**             | **安全强制更新**：修复 React Server Components DoS 漏洞 (CVE-2026-23864)，19.2.0-19.2.3 存在被攻击风险，必须升级至 19.2.4+  |
| **UI组件** | Tailwind CSS 4 + Headless UI | **^4.2.1** + **^2.2.9** | **4.2.1 为当前 Latest**（2026-02-23 发布），4.1.x 已于 2026-02-18 结束支持；Headless UI 2.2.9 为最新稳定版              |
| **后端**   | FastAPI                      | **^0.135.1**            | **最新稳定版**（2026-03-01 发布），0.130.0 起引入 Rust-based Pydantic JSON 序列化，性能提升 2 倍+                        |
| **统一存储** | **LanceDB**                  | **^0.29.2**             | **重大版本更新**（2026-02-08 发布），支持多向量列查询、异步优化、RaBitQ 量化算法；0.21→0.29 包含 Lance 2.1 文件格式稳定                  |
| **全文索引** | Tantivy (LanceDB 内置)         | -                       | LanceDB 0.29.2 内置 Tantivy 0.19+，支持中文分词优化                                                           |
| **向量化**  | BAAI/bge-large-zh-v1.5       | -                       | 保持最新，v1.5 为当前最新稳定版                                                                                 |
| **爬虫**   | Crawl4AI                     | **^0.8.0**              | **重大架构更新**（2026-01-16 发布），0.2.4→0.8.0 为破坏性升级，新增 MCP 协议支持、浏览器池预热                                    |
| **LLM**  | DeepSeek/OpenAI (LiteLLM 路由) | LiteLLM **^1.81.9**     | **最新稳定版**（2026-02 发布），支持 GPT-5.2、MiniMax、Manus API 路由                                              |
| **部署**   | Docker Compose               | -                       | 保持推荐                                                                                               |


### 2.2 架构设计原则
1. **单体优先**：拒绝微服务，所有服务同一进程/容器组
2. **文件级存储**：LanceDB 单目录 `./data/campus.lance`，备份即 `cp -r data/`
3. **无状态服务**：应用层无状态，重启不丢数据（存储层持久化）
4. **防御性设计**：限流/熔断/降级，防止 LLM API 被刷爆；只读 API 防止公网篡改数据
5. **模块化边界**：按 IO/计算/业务严格分层，代码归属清晰

---

## 3. 系统架构设计

### 3.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                           公网接入层                                 │
│  ┌──────────────┐              Nginx (80/443)                       │
│  │   浏览器     │  ──────────►  ├─ /static/* → frontend/dist        │
│  │  (React SPA) │               ├─ /api/* → 127.0.0.1:8000 (FastAPI)│
│  │              │               └─ 方法限制: 仅 GET/HEAD/OPTIONS    │
│  └──────────────┘                                                   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP GET (只读)
┌─────────────────────────────┼───────────────────────────────────────┐
│                             ▼                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    FastAPI (127.0.0.1:8000)                    │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │  │
│  │  │/articles │  │ /search  │  │ /chat    │  │ /health  │     │  │
│  │  │ (列表)   │  │ (混合检索)│  │ (SSE流式)│  │ (健康检查)│    │  │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────────┘     │  │
│  │       │             │             │                           │  │
│  │       └─────────────┴─────────────┘                           │  │
│  │                     │                                         │  │
│  │              services/ (薄层编排)                              │  │
│  │       ┌─────────────┼─────────────┐                           │  │
│  │       ▼             ▼             ▼                           │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐                      │  │
│  │  │Retrieval│  │ Agent   │  │ Article │                      │  │
│  │  │Service  │  │Service  │  │Service  │                      │  │
│  │  └────┬────┘  └────┬────┘  └────┬────┘                      │  │
│  │       │            │            │                             │  │
│  └───────┼────────────┼────────────┼───────────────────────────────┘  │
│          │            │            │                                │
│          ▼            ▼            ▼                                │
│  ┌──────────────┐  ┌─────────────────┐  ┌──────────────┐         │
│  │  retrieval/  │  │    agent/       │  │     data/    │         │
│  │  LanceTable  │  │  ReAct Engine   │  │  Repository  │         │
│  │  HybridSearch│  │  Tool Registry  │  │   (CRUD)     │         │
│  └──────┬───────┘  └─────────────────┘  └──────┬───────┘         │
│         │                                       │                  │
│         └───────────────────┬───────────────────┘                  │
│                             ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │         LanceDB (./data/campus.lance)                        │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  Table: articles                                       │  │  │
│  │  │  ├── id (int)                                          │  │  │
│  │  │  ├── title (str)                                       │  │  │
│  │  │  ├── content (str) ← Tantivy FTS 索引                  │  │  │
│  │  │  ├── vector (768d) ← 向量索引 (IVF-PQ)                 │  │  │
│  │  │  ├── source (str) ← 结构化过滤                         │  │  │
│  │  │  ├── url (str) ← 唯一标识                              │  │  │
│  │  │  └── created_at (timestamp)                          │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              ▲
                              │ 本地 SSH 写入 (维护模式)
┌─────────────────────────────┴───────────────────────────────────────┐
│                         crawler/ (独立包，本地执行)                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                    │
│  │  spiders/  │  │  config/   │  │  adapters/ │                    │
│  │ (Crawl4AI) │  │ (*.yaml)   │  │ (LanceDB)  │                    │
│  └────────────┘  └────────────┘  └────────────┘                    │
│                                                                     │
│  CLI: python -m crawler crawl --config config/jwc.yaml             │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 模块依赖关系 (Dependency Graph)

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│    core     │◄─────│    data     │      │    llm      │
│  (配置/日志)  │      │  (LanceDB)  │      │  (客户端)    │
└─────────────┘      └──────┬──────┘      └──────┬──────┘
                            │                    │
                            ▼                    ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   crawler   │─────►│  ingestion  │      │  retrieval  │
│ (采集器)     │      │   (ETL)     │      │  (检索引擎)  │
└─────────────┘      └──────┬──────┘      └──────┬──────┘
                            │                    │
                            └──────────┬─────────┘
                                       ▼
                            ┌─────────────┐
                            │    agent    │
                            │ (ReAct引擎)  │
                            └──────┬──────┘
                                   │
                                   ▼
                            ┌─────────────┐
                            │     app     │
                            │  (API组装)   │
                            └─────────────┘
```

**依赖原则**：
- `core`：无依赖，被所有层使用（配置、常量、日志）
- `data`：仅依赖 `core`，纯 IO 层，无业务逻辑
- `ingestion`：依赖 `data` 和 `core`，包含 Embedding 计算
- `retrieval`：依赖 `data`，可依赖 `llm`（重排序）
- `agent`：依赖 `llm` 和 `retrieval`
- `app`：最薄，仅组装所有层

---

## 4. 详细目录架构

```text
campus-assistant/
├── README.md                          # 项目说明与快速启动
├── Makefile                           # 常用命令: make dev, make deploy
├── docker-compose.yml                 # 单容器部署 (FastAPI + Nginx)
├── .gitignore                         # 忽略: data/, __pycache__, node_modules
│
├── frontend/                          # 前端应用
│   ├── dist/                          # [构建产物] Nginx 根目录
│   ├── public/
│   │   └── favicon.ico
│   ├── src/
│   │   ├── api/                       # API 客户端 (自动生成类型)
│   │   │   ├── client.ts              # Axios 实例 (baseURL: '/api')
│   │   │   ├── articles.ts            # GET /api/articles
│   │   │   └── chat.ts                # GET /api/chat (EventSource)
│   │   │
│   │   ├── components/                # React 组件
│   │   │   ├── Chat/                  # 对话组件 (流式渲染)
│   │   │   │   ├── MessageBubble.tsx  # 消息气泡 (Markdown + 代码高亮)
│   │   │   │   ├── StreamInput.tsx    # 输入框 (带发送状态)
│   │   │   │   └── index.tsx
│   │   │   ├── ArticleList/           # 文章列表 (虚拟滚动)
│   │   │   │   ├── VirtualList.tsx
│   │   │   │   └── ArticleCard.tsx
│   │   │   └── Search/                # 搜索页
│   │   │       ├── SearchBox.tsx
│   │   │       └── FilterBar.tsx      # 来源筛选 (教务处/图书馆)
│   │   │
│   │   ├── hooks/                     # 自定义 Hooks
│   │   │   ├── useSSE.ts              # Server-Sent Events 封装
│   │   │   └── useArticles.ts         # SWR 数据获取
│   │   │
│   │   ├── types/                     # TypeScript 类型
│   │   │   └── api.ts                 # 从 FastAPI OpenAPI 生成
│   │   │
│   │   ├── App.tsx                    # 路由配置
│   │   └── main.tsx                   # 入口
│   │
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── vite.config.ts                 # 开发代理: /api → 127.0.0.1:8000
│
├── backend/                           # 后端应用
│   ├── app/                           # API 组装层 (最薄)
│   │   ├── api/                       # 接口层 (仅 GET，公网暴露)
│   │   │   ├── __init__.py
│   │   │   └── v1/
│   │   │       ├── __init__.py
│   │   │       ├── articles.py        # GET /api/v1/articles
│   │   │       ├── search.py          # GET /api/v1/search
│   │   │       └── chat.py            # GET /api/v1/chat/stream (SSE)
│   │   │
│   │   ├── services/                  # 应用服务层 (薄层, 仅编排)
│   │   │   ├── __init__.py
│   │   │   ├── chat_service.py        # 编排 Agent + 流式响应
│   │   │   └── search_service.py      # 封装 retrieval 给 API 用
│   │   │
│   │   ├── core/                      # 基础设施
│   │   │   ├── __init__.py
│   │   │   ├── config.py              # Pydantic Settings
│   │   │   ├── logging.py             # 结构化日志
│   │   │   ├── exceptions.py          # 自定义异常基类
│   │   │   ├── constants.py           # 路径、版本等常量
│   │   │   └── lancedb_client.py      # LanceDB 连接管理
│   │   │
│   │   └── main.py                    # FastAPI 实例创建
│   │
│   ├── agent/                             # ReAct Agent 引擎
│   │   ├── __init__.py                    # 导出: ReActAgent, Tool, AgentAction
│   │   ├── core.py                        # ReActAgent 类 (思考-行动-观察循环)
│   │   ├── llm_client.py                  # LLM 客户端 (DeepSeek/OpenAI)
│   │   ├── tools.py                       # Tool 协议与注册表
│   │   ├── prompts.py                     # ReAct Prompt 模板 (Jinja2)
│   │   ├── schemas.py                     # Pydantic 模型 (AgentAction, AgentFinish)
│   │   └── memory.py                      # 对话历史管理
│   │
│   ├── retrieval/                         # 检索引擎
│   │   ├── __init__.py                    # 导出: LanceStore, HybridRetriever
│   │   ├── engine.py                      # HybridRetriever 类 (向量+全文融合)
│   │   ├── store.py                       # LanceDB Table 封装 (CRUD + 索引)
│   │   ├── models.py                      # LanceModel 定义 (Article Schema)
│   │   ├── schema/
│   │   │   └── article.py                 # Article LanceModel (含向量字段)
│   │   └── utils/
│   │       └── embedding.py               # BAAI/bge-large-zh 本地缓存
│   │
│   ├── data/                              # 数据访问层 (纯 IO 无计算)
│   │   ├── __init__.py                    # 导出: Connection, Repository
│   │   ├── connection.py                  # LanceDB 连接池（纯 IO）
│   │   ├── repository.py                  # CRUD 封装（纯 IO）
│   │   ├── schema.py                      # 表结构描述（供 SQL Tool 使用）
│   │   └── guard.py                       # SQL 安全验证（纯规则）
│   │
│   ├── ingestion/                         # 数据摄取管道 (ETL)
│   │   ├── __init__.py                    # 导出: IngestionPipeline
│   │   ├── pipeline.py                    # ETL：验证 → Embedding生成 → 写入 data
│   │   ├── embedder.py                    # Embedding 客户端（仅此处使用）
│   │   ├── validators.py                  # 数据验证
│   │   ├── dedup.py                       # 去重逻辑 (URL/SimHash)
│   │   ├── normalizers.py                 # 标准化 (时间格式, 编码统一)
│   │   └── adapters/
│   │       └── crawler.py                 # 接收 crawler 数据，调用 pipeline
│   │
│   ├── crawler/                           # 爬虫模块 (独立包，本地执行)
│   │   ├── __init__.py
│   │   ├── cli.py                         # 入口: python -m crawler crawl ...
│   │   ├── spiders/                       # 爬虫实现
│   │   │   ├── __init__.py
│   │   │   └── base.py                    # 通用 Spider 基类 (Crawl4AI 封装)
│   │   │
│   │   ├── config/                        # 爬虫规则配置 (YAML)
│   │   │   ├── jwc.yaml                   # 教务处规则 (CSS 选择器等)
│   │   │   ├── lib.yaml                   # 图书馆规则
│   │   │   └── schema.yaml                # 配置校验 Schema
│   │   │
│   │   └── adapters/                      # 输出适配器
│   │       ├── __init__.py
│   │       ├── base.py                    # Adapter 协议
│   │       └── lance_adapter.py           # 直接写入 LanceDB
│   │
│   ├── pyproject.toml                 # Python 依赖
│   └── Dockerfile                     # 后端镜像
├── config/                            # 全局配置
│   ├── app.yaml                       # 应用配置 (端口, 日志级别)
│   └── llm.yaml                       # LLM 路由配置 (DeepSeek/OpenAI)
│
├── scripts/                           # 运维脚本 (本地执行)
│   ├── backup.sh                      # 备份: tar czf campus-$(date).tar.gz data/
│   ├── restore.sh                     # 恢复脚本
│   └── update_cron.sh                 # 定时任务入口
│
├── deployment/                        # 部署配置
│   ├── nginx/
│   │   └── campus.conf                # Nginx 站点配置 (反向代理 + 只读限制)
│   └── systemd/
│       └── campus-api.service         # Systemd 服务文件
│
└── data/                              # [生产数据] gitignored
     ├── campus.lance/                  # LanceDB 存储目录 (单目录即完整 DB)
     ├── articles.lance             # 主表 (列式存储)
     └── _indices/                  # Tantivy 全文索引 + 向量索引


```

---

## 5. 核心模块设计

### 5.1 LanceDB Schema (统一存储核心)

```python
# retrieval/models/article.py
import lancedb
from lancedb.pydantic import LanceModel, Vector
from lancedb.embeddings import get_registry
from datetime import datetime

# 配置嵌入模型 (BAAI/bge-large-zh)
embeddings = get_registry().get("sentence-transformers").create(
    name="BAAI/bge-large-zh",
    device="cpu"
)

class Article(LanceModel):
    """
    统一 Schema: 元数据 + 向量 + 全文索引
    单表替代 SQLite + ChromaDB
    """
    # 主键
    id: int
    
    # 结构化字段 (SQL 可查询)
    title: str
    content: str                           # 原始 Markdown
    source: str                            # 'jwc', 'lib', 'manual'
    url: str                               # 唯一标识
    created_at: datetime
    
    # 向量字段 (768维, 自动嵌入)
    vector: Vector(embeddings.ndims()) = embeddings.VectorField()
    
    # 全文搜索字段 (Tantivy 索引)
    # LanceDB 自动将 SourceField 用于 FTS
    text: str = embeddings.SourceField()   # 默认 = content, 可被 Tantivy 索引
    
    class Config:
        # 额外元数据 (非搜索, 仅存储)
        extra_metadata: dict = {}

# 表创建与索引初始化
def init_lance_table(db: lancedb.DBConnection):
    table = db.create_table("articles", schema=Article, exist_ok=True)
    
    # 创建全文索引 (Tantivy, 支持中文)
    table.create_fts_index("text", use_tantivy=True)
    
    return table
```

### 5.2 数据访问层 (data/) - 纯 IO 无计算

```python
# data/connection.py
import lancedb
from core.config import settings

class LanceDBConnection:
    """连接池管理，线程安全"""
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance.db = lancedb.connect(settings.LANCE_DB_PATH)
        return cls._instance
    
    def get_table(self, name: str = "articles"):
        return self.db.open_table(name)

# data/repository.py
from typing import List, Optional
from .connection import LanceDBConnection

class ArticleRepository:
    """纯 CRUD，无业务逻辑，无 Embedding 计算"""
    def __init__(self):
        self.table = LanceDBConnection().get_table("articles")
    
    def get_by_id(self, id: int) -> Optional[dict]:
        return self.table.search().where(f"id = {id}").limit(1).to_list()
    
    def list_recent(self, limit: int = 20, source: Optional[str] = None):
        query = self.table.search().limit(limit)
        if source:
            query = query.where(f"source = '{source}'")
        return query.to_list()
    
    def add(self, documents: List[dict]):
        """原始写入，Embedding 由 LanceModel 自动处理或外部预计算"""
        self.table.add(documents)
```

### 5.3 检索引擎 (retrieval/) - 被 agent 使用

```python
# retrieval/engine.py
import lancedb
from typing import List, Optional

class HybridRetriever:
    """
    混合检索引擎:
    - 原生支持向量 + 全文 + 结构化过滤
    - 自动 RRF 融合, 无需 Python 层实现
    """
    def __init__(self, db_path: str = "./data/campus.lance"):
        self.db = lancedb.connect(db_path)
        self.table = self.db.open_table("articles")
    
    def search(
        self,
        query: str,
        top_k: int = 5,
        source_filter: Optional[str] = None,
        date_after: Optional[str] = None
    ) -> List[dict]:
        """
        混合搜索 (向量 + 全文 + 结构化过滤)
        """
        # 构建查询
        search_query = self.table.search(query, query_type="hybrid")
        
        # 结构化过滤 (LanceDB 原生支持 SQL WHERE)
        filters = []
        if source_filter:
            filters.append(f"source = '{source_filter}'")
        if date_after:
            filters.append(f"created_at > timestamp '{date_after}'")
        
        if filters:
            search_query = search_query.where(" AND ".join(filters))
        
        # 执行并返回
        results = search_query.limit(top_k).to_list()
        
        # 格式化输出 (保持与旧 API 兼容)
        return [
            {
                "id": r["id"],
                "title": r["title"],
                "content": r["content"][:300],  # 摘要
                "source": r["source"],
                "score": r.get("_score", 0),    # 融合分数
                "url": r["url"]
            }
            for r in results
        ]
```

### 5.4 Agent 引擎 (agent/) - ReAct 循环

```python
# agent/core.py
import json
from typing import List, Dict, Callable
from .tools import Tool
from .schemas import AgentAction, AgentFinish

class ReActAgent:
    """
    ReAct 决策引擎:
    - 维护 Tool 注册表 (检索工具)
    - 与 LLM Client 交互, 但 LLM 是基础设施, 非业务逻辑
    """
    def __init__(self, llm_client, tools: List[Tool]):
        self.llm = llm_client
        self.tools: Dict[str, Callable] = {t.name: t for t in tools}
        self.max_steps = 3
    
    async def run(self, query: str) -> AgentFinish:
        trajectory = []
        
        for step in range(self.max_steps):
            # 构造 ReAct Prompt
            prompt = self._build_prompt(query, trajectory)
            
            # 调用 LLM (通过 core.llm_client)
            response = await self.llm.chat(prompt)
            parsed = json.loads(response)
            
            action = AgentAction(**parsed["action"])
            trajectory.append({"thought": parsed["thought"], "action": action})
            
            # 执行 Tool
            if action.name == "finish":
                return AgentFinish(answer=action.input["answer"])
            
            tool_result = await self.tools[action.name](**action.input)
            trajectory.append({"observation": tool_result})
        
        # 超过步数强制结束
        return AgentFinish(answer=self._force_answer(query, trajectory))
```

### 5.5 Ingestion 管道 (ingestion/) - ETL 中心

```python
# ingestion/pipeline.py
from data.repository import ArticleRepository
from .validators import URLValidator, ContentValidator
from .dedup import URLDedup
from .normalizers import normalize_datetime

class IngestionPipeline:
    """
    数据摄取管道:
    - 接收 Crawler 原始数据
    - 验证 → 去重 → 标准化 → 写入 LanceDB
    - 原子操作, 失败即回滚 (LanceDB 事务支持)
    """
    def __init__(self):
        self.repo = ArticleRepository()
        self.validators = [URLValidator(), ContentValidator()]
        self.dedup = URLDedup()
    
    async def process(self, raw: dict) -> dict:
        # 1. 验证
        if not all(v.validate(raw) for v in self.validators):
            return {"status": "invalid", "url": raw.get("url")}
        
        # 2. 去重
        if await self.dedup.exists(raw["url"]):
            return {"status": "duplicate", "url": raw["url"]}
        
        # 3. 标准化
        doc = {
            "id": await self._next_id(),
            "title": raw["title"],
            "content": raw["content"],
            "source": raw["metadata"]["source"],
            "url": raw["url"],
            "created_at": normalize_datetime(raw["metadata"].get("date")),
            # vector 由 LanceDB 自动计算 (通过 LanceModel) 或 ingestion/embedder.py 预计算
        }
        
        # 4. 原子写入 (LanceDB 保证一致性)
        try:
            self.repo.add([doc])
            await self.dedup.mark(raw["url"])
            return {"status": "success", "id": doc["id"]}
        except Exception as e:
            return {"status": "error", "message": str(e), "url": raw["url"]}
```

---

## 6. 数据流详细设计

### 6.1 网页采集 → 入库流 (本地维护)

```
教务处官网 (Vue/React 渲染)
    ↓
Crawler CLI (SSH 本地执行)
    ↓
Crawl4AI (Playwright 等待渲染)
    ↓
提取 Markdown + 元数据 (标题/时间/来源)
    ↓
ingestion/pipeline.py
    ├─ 验证 (URL 格式, 内容非空, 长度检查)
    ├─ 去重 (URL 哈希检查, SimHash 内容相似度)
    ├─ 标准化 (统一 UTF-8, 时间格式 ISO8601)
    ↓
Embedding 生成 (BAAI/bge-large-zh)
    ↓
LanceDB.add() (原子操作)
    ├─ 列式存储 (Parquet 格式, 元数据)
    ├─ 向量索引 (IVF-PQ, 768维)
    └─ 全文索引 (Tantivy, BM25, 中文分词)
    
完成索引: 单目录 ./data/campus.lance/ (备份只需 cp -r)
```

### 6.2 用户问答流 (RAG) - 公网只读

```
用户提问 "什么时候补考?"
    ↓ HTTP GET /api/chat/stream?q=...
Nginx (方法检查: 仅 GET)
    ↓
FastAPI /chat
    ↓
chat_service (SSE 流式包装)
    ├─ 调用 agent/ReActAgent
    │   ├─ Thought: 需要搜索相关通知
    │   ├─ Action: search_keyword("补考 时间")
    │   ↓
    │   retrieval/HybridRetriever
    │       ├─ 向量搜索 (语义相似)
    │       ├─ Tantivy 全文 (关键词匹配)
    │       └─ 自动 RRF 融合
    │   ← 返回 Top-5 文档 (标题/摘要/URL)
    │   Observation: [相关文档列表...]
    │   ← Thought: 已找到教务处补考通知
    │   Action: finish(answer="根据教务处通知...")
    ↓
SSE 流式推送 (打字机效果，分句推送)
    ↓
前端 Chat 组件渲染
    ↓
SQLite 审计日志 (可选，记录 Query 但不记录敏感信息)
```

### 6.3 管理后台数据流

```
管理员访问 /admin (Basic Auth 或 IP 白名单)
    ↓
请求最近文章 /api/articles/recent?limit=50
    ↓
ArticleRepository.list_recent()
    ↓
LanceDB SQL 查询 (SELECT * ORDER BY created_at DESC)
    ↓
返回 JSON (标题/来源/时间，不含大向量字段)
```

---

## 7. Week 1 接口冻结契约

### 7.1 数据 Schema (Pydantic)

```python
# 用于 API 文档和前后端契约
from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime

class ArticleOut(BaseModel):
    """文章列表返回结构"""
    id: int
    title: str
    content: str                  # Markdown 格式正文 (前端截取显示)
    source: str                   # 来源名称，如 "教务处"
    url: str                      # 原文链接
    created_at: datetime
    score: Optional[float] = None # 搜索相关性分数

class ChatRequest(BaseModel):
    """聊天请求 (Query 参数，因使用 SSE)"""
    q: str                        # 用户问题 (URL 编码)
    session_id: Optional[str] = None  # 会话 ID (连续对话上下文)

class ChatStreamChunk(BaseModel):
    """SSE 流式数据包"""
    content: str                  # 本次推送的文本块
    role: Literal["assistant", "system"] = "assistant"
    finish_reason: Optional[str] = None  # "stop" 或 "length"
    sources: Optional[list] = None # 引用来源 (最后一条推送包含)
```

### 7.2 API 契约 (Week 1 冻结)

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/v1/articles` | GET | 最近文章，支持 `?source=` 和 `?limit=` |
| `/api/v1/articles/{id}` | GET | 详情，返回完整 content |
| `/api/v1/search` | GET | 混合检索，`?q=` 查询词，`?source=` 筛选 |
| `/api/v1/chat/stream` | GET | SSE 流式对话，`?q=` 问题 |
| `/api/health` | GET | 健康检查，返回 LanceDB 连接状态 |
| `/api/metrics` | GET | 监控数据 (Prometheus 格式，可选) |

**Nginx 安全限制**：
```nginx
# 只允许读取操作，公网暴露
if ($request_method !~ ^(GET|HEAD|OPTIONS)$) {
    return 405;
}
```
