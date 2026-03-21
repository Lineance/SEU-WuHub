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
SEU-WuHub/
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

## 7. LanceDB 存储引擎详细设计

### 7.1 功能特性

#### 数据结构设计
- **完整字段支持**：包含 14 个字段，涵盖新闻元数据、内容、向量和版本控制
- **双向量模型**：标题使用 384 维向量，正文使用 1024 维向量
- **版本控制**：支持增量更新和版本追踪
- **标签系统集成**：支持预定义标签的向量匹配和自动分配

#### Markdown 文本处理
- **智能提取**：从 Markdown 中提取纯文本内容用于向量化
- **格式保留**：同时保留原始 Markdown 内容
- **内容清洗**：支持 HTML 标签移除、Unicode 规范化等

#### 数据向量化
- **双模型策略**：
  - 标题：`paraphrase-multilingual-MiniLM-L12-v2` (384 维)
  - 正文：`BAAI/bge-large-zh` (1024 维)
- **批量处理**：支持批量向量化，提高处理效率
- **查询优化**：为 BGE 模型自动添加检索前缀

#### 数据插入与更新
- **智能去重**：基于 URL 哈希和 SimHash 的重复检测
- **版本控制**：支持 `crawl_version` 递增更新
- **原子操作**：使用 LanceDB 的 `merge_insert` 确保数据一致性
- **标签自动匹配**：基于向量相似度的自动标签分配

#### 混合检索
- **向量搜索**：基于余弦相似度的语义检索
- **全文搜索**：基于 Tantivy 的关键词匹配
- **混合搜索**：向量和关键词结果的智能融合
- **高级过滤**：支持时间范围、来源、作者、标签等多维度过滤

### 7.2 模块结构

```
backend/
├── data/                    # 数据层
│   ├── schema.py           # 数据结构定义
│   ├── connection.py       # LanceDB 连接管理
│   ├── repository.py       # CRUD 操作
│   ├── guard.py           # SQL 安全验证
│   ├── tag_schema.py      # 标签数据结构
│   └── tag_repository.py  # 标签数据存储
├── ingestion/              # 数据摄取层
│   ├── normalizers.py     # 数据标准化
│   ├── embedder.py        # 双模型向量化
│   ├── validators.py      # 数据验证
│   ├── dedup.py           # 去重逻辑
│   ├── pipeline.py        # ETL 主流程
│   ├── tag_initializer.py # 标签系统初始化
│   ├── tag_matcher.py     # 标签匹配引擎
│   └── adapters/          # 数据源适配器
│       └── crawler.py     # 爬虫数据适配
└── retrieval/             # 检索层
    ├── schema/article.py  # LanceModel 定义
    ├── utils/embedding.py # 查询向量化
    ├── store.py           # 表操作封装
    └── engine.py          # 混合检索引擎
```

### 7.3 数据流

1. **数据准备**：爬虫数据 → CrawlerAdapter → 标准化数据
2. **ETL 处理**：验证 → 标准化 → 去重 → 向量化 → 标签匹配 → 写入
3. **索引构建**：向量索引 (IVF-PQ) + 全文索引 (Tantivy) + 标签索引
4. **检索服务**：查询 → 向量化 → 混合搜索 → 结果融合 → 标签过滤

### 7.4 核心组件使用示例

#### IngestionPipeline (ETL 管道)
```python
from ingestion import IngestionPipeline

# 创建管道
pipeline = IngestionPipeline(
    db_path="data/campus.lance",
    skip_validation=False,
    skip_dedup=False,
)

# 批量处理
result = pipeline.process_batch(documents, batch_size=32)
print(result.summary())
```

#### RetrievalEngine (检索引擎)
```python
from retrieval import create_engine

# 创建引擎
engine = create_engine("data/campus.lance")

# 混合搜索
results = engine.search(
    query="人工智能",
    search_type="hybrid",
    limit=10,
    vector_weight=0.6,
    keyword_weight=0.4,
)

# 高级搜索（带标签过滤）
advanced_results = engine.advanced_search(
    query="东南大学学术活动",
    vector_weight=0.6,
    keyword_weight=0.4,
    title_weight=0.3,
    content_weight=0.7,
    limit=5,
    source_site="计算机科学与工程学院",
    tags=["学术讲座", "科研项目"]
)
```

#### LanceStore (表操作)
```python
from retrieval import create_store

# 创建存储
store = create_store("data/campus.lance", create_indices=True)

# 索引管理
store.create_vector_index("content_embedding")
store.create_fulltext_index()

# 搜索操作
vector_results = store.vector_search(query_vector, limit=10)
text_results = store.fulltext_search("关键词", limit=10)
```

### 7.5 配置说明

#### 模型配置
```python
# 在 embedder.py 中配置
TITLE_MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"
CONTENT_MODEL_NAME = "BAAI/bge-large-zh"
TAG_MODEL_NAME = "BAAI/bge-large-zh"  # 标签使用与正文相同的模型
```

#### 数据库配置
```python
# 在 connection.py 中配置
DEFAULT_DB_PATH = "data/campus.lance"
ARTICLE_TABLE_NAME = "articles"
TAG_TABLE_NAME = "tags"
```

#### 索引配置
```python
# 在 store.py 中配置
VECTOR_INDEX_CONFIG = {
    "index_type": "IVF_PQ",
    "num_partitions": 256,
    "num_sub_vectors": 96,
    "metric": "cosine",
}
```

#### 标签匹配配置
```yaml
# 在 config/tags.yaml 中配置
matching:
  strict_threshold: 0.75      # 严格模式阈值 (0.0-1.0)
  relaxed_threshold: 0.5      # 宽松模式阈值 (0.0-1.0)
  max_tags_per_article: 5     # 每篇文章最大标签数
  similarity_method: "cosine" # 相似度计算方法
  enable_cache: true          # 启用标签缓存
  cache_ttl: 3600            # 缓存TTL（秒）
```

### 7.6 性能优化

#### 批量处理
- **向量化**：支持批量处理，减少模型加载次数
- **写入**：使用 LanceDB 的批量插入接口
- **索引**：异步构建索引，不影响写入性能
- **标签匹配**：批量计算相似度，优化计算效率

#### 缓存策略
- **模型缓存**：SentenceTransformer 模型单例模式
- **连接池**：LanceDB 连接复用
- **结果缓存**：热门查询结果缓存
- **标签缓存**：标签向量和元数据缓存

#### 内存管理
- **流式处理**：支持大文件流式读取
- **分块处理**：大数据集分块处理
- **内存监控**：自动监控内存使用
- **向量分块**：大型向量数据分块存储和检索

### 7.7 错误处理

#### 验证错误
- **字段验证**：必填字段检查
- **格式验证**：URL、日期格式验证
- **内容验证**：内容长度、编码检查
- **向量验证**：向量维度一致性检查

#### 处理错误
- **向量化错误**：模型加载失败处理
- **写入错误**：数据库连接异常处理
- **索引错误**：索引构建失败处理
- **标签匹配错误**：相似度计算异常处理

#### 恢复机制
- **断点续传**：支持从失败点恢复
- **数据回滚**：写入失败时自动回滚
- **索引重建**：索引损坏时自动重建
- **日志记录**：详细的操作日志

### 7.8 监控与维护

#### 监控指标
- **导入统计**：成功/失败/重复计数
- **搜索性能**：响应时间、召回率、准确率
- **标签统计**：标签使用频率、匹配准确率
- **系统资源**：CPU、内存、磁盘使用

#### 维护任务
- **索引优化**：定期优化索引
- **数据清理**：清理过期数据
- **备份恢复**：定期备份数据库
- **标签更新**：定期更新标签向量

#### 日志系统
- **操作日志**：记录所有关键操作
- **错误日志**：记录系统错误
- **性能日志**：记录性能指标
- **标签日志**：记录标签匹配结果

### 7.9 扩展开发

#### 添加新数据源
```python
# 实现新的适配器
from ingestion.adapters.crawler import CrawlerAdapter

class CustomAdapter(CrawlerAdapter):
    def convert_one(self, raw_data):
        # 自定义转换逻辑
        pass
```

#### 添加新搜索功能
```python
# 扩展检索引擎
from retrieval.engine import RetrievalEngine

class CustomEngine(RetrievalEngine):
    def semantic_search_with_filters(self, query, filters, **kwargs):
        # 自定义语义搜索逻辑
        pass
```

#### 集成外部系统
```python
# 集成到 Web 服务
from fastapi import FastAPI
from retrieval import create_engine

app = FastAPI()
engine = create_engine()

@app.get("/search")
async def search(query: str, limit: int = 10, tags: list[str] = None):
    results = engine.search(
        query=query, 
        limit=limit,
        tags=tags  # 支持标签过滤
    )
    return results
```

### 7.10 故障排除

#### 常见问题
- **模型下载失败**：检查网络连接，使用镜像源
- **内存不足**：减小批量大小，增加内存
- **索引构建慢**：调整索引参数，使用 SSD
- **标签匹配不准确**：调整相似度阈值，优化标签描述

#### 调试方法
```python
# 启用调试日志
import logging
logging.basicConfig(level=logging.DEBUG)

# 检查数据库状态
from data import get_article_repository, get_tag_repository
article_repo = get_article_repository()
tag_repo = get_tag_repository()
print(f"文章记录数: {article_repo.count()}")
print(f"标签记录数: {tag_repo.count()}")

# 检查标签匹配
from ingestion.tag_matcher import TagMatcher
matcher = TagMatcher()
test_text = "学术讲座通知"
matches = matcher.match_tags(test_text)
print(f"测试文本标签匹配结果: {matches}")
```

#### 性能调优
- **向量维度**：根据需求调整向量维度
- **索引参数**：优化 IVF-PQ 参数
- **批处理大小**：根据内存调整批处理大小
- **缓存策略**：调整缓存大小和TTL

---

## 8. Week 1 接口冻结契约

### 8.1 数据 Schema (Pydantic)

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
    tags: Optional[list[str]] = None # 标签列表

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

### 8.2 API 契约 (Week 1 冻结)

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/v1/articles` | GET | 最近文章，支持 `?source=`、`?tags=` 和 `?limit=` |
| `/api/v1/articles/{id}` | GET | 详情，返回完整 content 和 tags |
| `/api/v1/search` | GET | 混合检索，`?q=` 查询词，`?source=`、`?tags=` 筛选 |
| `/api/v1/chat/stream` | GET | SSE 流式对话，`?q=` 问题 |
| `/api/v1/tags` | GET | 获取所有标签列表 |
| `/api/health` | GET | 健康检查，返回 LanceDB 连接状态 |
| `/api/metrics` | GET | 监控数据 (Prometheus 格式，可选) |

**Nginx 安全限制**：
```nginx
# 只允许读取操作，公网暴露
if ($request_method !~ ^(GET|HEAD|OPTIONS)$) {
    return 405;
}
```

---

## 9. 标签系统设计

### 9.1 标签架构

标签系统是 SEU-WuHub 的核心特性之一，支持：

1. **预定义标签**：通过配置文件定义的固定标签
2. **向量匹配**：基于描述文本的向量相似度匹配
3. **自动分配**：文章入库时自动分配相关标签
4. **过滤搜索**：支持按标签过滤搜索结果

### 9.2 标签数据结构

```python
# backend/data/tag_schema.py
@dataclass
class TagRecord:
    """标签记录的数据类"""
    tag_id: str                    # 标签唯一标识符
    name: str                     # 标签名称
    description: str              # 详细描述（用于向量匹配）
    embedding: list[float]        # 向量表示（1024维）
    category: str | None = None   # 分类
    created_at: datetime          # 创建时间
    updated_at: datetime          # 更新时间
```

### 9.3 标签匹配流程

1. **初始化阶段**：从 `config/tags.yaml` 加载标签配置，生成向量嵌入
2. **匹配阶段**：计算文章内容与标签描述的余弦相似度
3. **筛选阶段**：根据阈值筛选匹配的标签
4. **分配阶段**：为文章分配符合条件的标签

### 9.4 标签配置示例

```yaml
# config/tags.yaml
tags:
  - id: "tag_academic_lecture"
    name: "学术讲座"
    description: "学术讲座、学术报告、专家讲坛"
    category: "academic"
    priority: 1
    
  - id: "tag_research_project"
    name: "科研项目"
    description: "科研项目、课题研究、基金项目"
    category: "academic"
    priority: 1
```

### 9.5 标签系统集成

标签系统深度集成到数据流的各个环节：

1. **数据摄取**：文章入库时自动匹配标签
2. **检索过滤**：支持按标签过滤搜索结果
3. **内容分类**：基于标签实现内容智能分类
4. **用户界面**：前端展示文章标签，支持标签导航

---

## 10. 部署与运维

### 10.1 环境要求
- Python 3.13+
- Node.js 22+
- Docker & Docker Compose
- 足够磁盘空间（建议 > 10GB）

### 10.2 部署步骤
1. **环境准备**：安装依赖和配置环境变量
2. **数据库初始化**：初始化 LanceDB 数据库和标签系统
3. **服务启动**：启动后端 API 和前端应用
4. **数据导入**：运行爬虫采集初始数据
5. **监控配置**：配置日志收集和性能监控

### 10.3 运维指南
- **数据备份**：定期备份 `data/campus.lance` 目录
- **日志管理**：监控系统日志，及时处理异常
- **性能监控**：监控 API 响应时间和系统资源使用
- **版本升级**：遵循版本兼容性指南进行升级

---

## 11. 扩展与定制

### 11.1 添加新数据源
1. 在 `config/websites/` 中添加新的网站配置文件
2. 配置爬虫规则和选择器
3. 测试数据采集流程
4. 集成到现有数据流

### 11.2 定制标签系统
1. 修改 `config/tags.yaml` 添加新标签
2. 运行标签初始化脚本
3. 测试标签匹配效果
4. 调整匹配阈值和参数

### 11.3 扩展检索功能
1. 实现新的检索算法
2. 集成到 `retrieval/engine.py`
3. 添加相应的 API 端点
4. 更新前端界面支持新功能

---

*本文档最后更新：2026年3月19日*