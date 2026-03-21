# SEU-WuHub - 东南大学校园信息智能问答平台

SEU-WuHub 是一个面向高校师生的校园信息智能问答平台，整合教务处、图书馆等多部门通知公告，通过 RAG（检索增强生成）技术提供自然语言问答服务。

## 🎯 核心功能

- **多源信息采集**：官网爬虫 + 文件导入，支持增量采集和自动去重
- **智能问答系统**：基于大模型的 RAG 对话，支持流式响应
- **智能标签系统**：自动文章标签匹配，支持预定义标签和向量匹配
- **混合检索引擎**：向量搜索 + 全文搜索 + 结构化过滤，智能结果融合
- **信息聚合展示**：最近通知、分类浏览、来源筛选
- **统一数据存储**：基于 LanceDB 的单目录存储方案，零外部服务依赖

## 🏗️ 技术架构

### 后端技术栈
- **Python 3.13+**：主要编程语言
- **FastAPI 0.135+**：高性能 Web 框架
- **LanceDB 0.29+**：统一向量数据库（嵌入式）
- **Sentence Transformers**：BAAI/bge-large-zh 中文向量模型
- **Crawl4AI 0.8+**：现代化网页爬虫框架
- **LiteLLM 1.80+**：统一 LLM API 路由

### 前端技术栈
- **React 19.2.4+**：前端 UI 框架（安全版本）
- **TypeScript 5.9+**：类型安全 JavaScript
- **Vite 7.3+**：现代化构建工具
- **Tailwind CSS 4.2+**：实用优先的 CSS 框架

### 开发工具
- **Ruff**：极速 Python Linter & Formatter
- **Pytest**：测试框架
- **Docker Compose**：容器化开发环境
- **Make**：项目自动化工具

## 📁 项目结构

```
SEU-WuHub/
├── backend/                    # 后端应用
│   ├── app/                   # API 组装层 (FastAPI)
│   ├── agent/                 # ReAct Agent 引擎
│   ├── data/                  # 数据访问层 (LanceDB CRUD)
│   ├── ingestion/             # 数据摄取层 (ETL管道+标签系统)
│   ├── retrieval/             # 检索引擎 (混合搜索)
│   ├── crawler/               # 爬虫模块 (独立执行)
│   └── tests/                 # 后端测试
├── frontend/                  # 前端应用 (React + TypeScript)
│   ├── src/
│   │   ├── api/               # API 客户端
│   │   ├── components/        # React 组件
│   │   ├── hooks/             # 自定义 Hooks
│   │   └── types/             # TypeScript 类型定义
│   └── public/
├── config/                    # 配置文件
│   ├── app.yaml              # 应用配置
│   ├── tags.yaml             # 标签系统配置
│   └── websites/             # 网站爬虫配置
├── docs/                     # 项目文档
│   ├── ARCHITECTURE.md       # 架构设计文档
│   ├── MODULE_INTEGRATION.md # 模块集成指南
│   └── DEPLOYMENT.md         # 部署指南
├── scripts/                  # 运维脚本
├── data/                     # 数据存储 (git忽略)
└── logs/                     # 日志文件 (git忽略)
```

## 🚀 快速开始

### 环境要求
- Python 3.13+
- Node.js 22+
- Docker & Docker Compose (可选)
- Git

### 1. 后端环境设置

```bash
# 进入后端目录
cd backend

# 使用 uv 安装依赖 (推荐)
uv sync --extra dev

# 或者使用传统方式
pip install -e .
```

### 2. 前端环境设置

```bash
# 进入前端目录
cd frontend

# 安装依赖
npm install
```

### 3. 数据库初始化

```bash
# 初始化 LanceDB 数据库
cd backend
python -c "from backend.data.connection import init_database; init_database()"

# 初始化标签系统
python -m backend.ingestion.tag_initializer --config ../config/tags.yaml
```

### 4. 启动开发服务

**选项 A：使用 Docker Compose（推荐）**

```bash
# 启动所有服务
docker-compose up --build

# 后端 API: http://localhost:8000
# 前端应用: http://localhost:5173
```

**选项 B：手动启动**

```bash
# 后端服务
cd backend
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 前端服务 (新终端)
cd frontend
npm run dev
```

## 📖 开发指南

### 常用命令

```bash
# 代码质量检查
make backend-lint      # Python 代码检查
make backend-format    # Python 代码格式化
make frontend-lint     # TypeScript 代码检查
make frontend-format   # TypeScript 代码格式化

# 测试
make backend-test      # Python 测试
make frontend-test     # TypeScript 测试

# 安全扫描
make backend-security  # Python 安全扫描

# 类型检查
make backend-typecheck # Python 类型检查
```

### 数据采集示例

```bash
# 使用爬虫采集教务处通知
cd backend
python -m crawler.src.list_to_articles_e2e --website jwc --max-pages 3 --output ../tmp/jwc_data.json
```

### 标签系统使用

```bash
# 初始化标签系统
cd backend
python -m ingestion.tag_initializer --config ../config/tags.yaml

# 手动运行标签匹配
python -c "from ingestion.tag_matcher import TagMatcher; matcher = TagMatcher(); results = matcher.match_tags('学术讲座通知内容')"
```

## 🔧 核心模块

### 1. 数据层 (`backend/data/`)
- **LanceDB 连接管理**：线程安全的数据库连接池
- **数据仓库操作**：纯 CRUD 操作，无业务逻辑
- **标签系统存储**：标签向量存储和匹配
- **SQL 安全防护**：防止 SQL 注入攻击

### 2. 数据摄取层 (`backend/ingestion/`)
- **ETL 管道**：验证 → 标准化 → 去重 → 向量化 → 写入
- **标签系统**：自动标签匹配，支持向量相似度匹配
- **向量化服务**：BAAI/bge-large-zh 中文向量模型
- **数据验证**：URL、内容、格式验证

### 3. 检索引擎 (`backend/retrieval/`)
- **混合搜索**：向量搜索 + 全文搜索 + 结构化过滤
- **智能融合**：RRF 结果融合算法
- **多维度过滤**：时间范围、来源、标签过滤

### 4. 爬虫模块 (`backend/crawler/`)
- **增量采集**：URL 去重和状态管理
- **智能渲染**：Playwright 动态页面渲染
- **缓存优化**：多级缓存策略
- **配置驱动**：YAML 配置，无需代码修改

### 5. Agent 引擎 (`backend/agent/`)
- **ReAct 决策**：思考-行动-观察循环
- **工具调用**：检索工具集成
- **流式响应**：SSE 实时推送
- **对话历史**：上下文记忆管理

## 🗂️ 配置管理

### 应用配置 (`config/app.yaml`)
```yaml
server:
  host: "0.0.0.0"
  port: 8000
  reload: true

database:
  path: "./data/campus.lance"
  table_name: "articles"

embedding:
  title_model: "paraphrase-multilingual-MiniLM-L12-v2"
  content_model: "BAAI/bge-large-zh"
```

### 标签配置 (`config/tags.yaml`)
```yaml
tags:
  - id: "tag_academic_lecture"
    name: "学术讲座"
    description: "学术讲座、学术报告、专家讲坛"
    category: "academic"
    priority: 1
    
  - id: "tag_student_activity"
    name: "学生活动"
    description: "学生活动、社团活动、文体比赛"
    category: "campus_life"
    priority: 1
```

### 网站配置 (`config/websites/jwc.yaml`)
```yaml
website:
  start_urls:
    - "https://jwc.seu.edu.cn/jwxx/list.htm"
  
  list_incremental:
    max_pages: 31
    state_file: "tmp/jwc_seen_urls.json"
  
  overrides:
    article_crawler:
      css_selector: ".wp_articlecontent, .Article_Content"
      markdown_generator:
        type: "default"
        content_filter:
          type: "pruning"
```

## 📊 数据流程

### 网页采集 → 入库流程
1. **列表页增量发现**：按站点配置发现新文章 URL
2. **文章页抓取**：使用 Crawl4AI 提取内容和元数据
3. **ETL 处理**：验证 → 标准化 → 去重 → 向量化
4. **标签匹配**：基于向量相似度自动分配标签
5. **数据库写入**：原子写入 LanceDB，自动构建索引

### 用户问答流程
1. **用户提问**：前端发送查询请求
2. **混合检索**：向量 + 全文 + 结构化过滤
3. **Agent 决策**：ReAct 引擎分析问题，调用工具
4. **RAG 生成**：检索结果 + LLM 生成答案
5. **流式返回**：SSE 实时推送，打字机效果

## 🚢 部署

### 本地开发部署
```bash
# 使用 Docker Compose
docker-compose up --build

# 或手动部署
cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000
cd frontend && npm run build && nginx -c nginx.conf
```

### 生产部署
1. **环境准备**：安装 Python、Node.js、Docker
2. **配置文件**：更新生产环境配置
3. **数据库初始化**：初始化 LanceDB 和标签系统
4. **服务启动**：使用 systemd 或 Docker Compose
5. **监控配置**：日志收集和性能监控

详细部署指南请参考 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。

## 📈 项目状态

### ✅ 已完成功能
- [x] LanceDB 统一存储方案
- [x] 数据摄取 ETL 管道
- [x] 混合检索引擎
- [x] 标签系统（自动匹配）
- [x] 爬虫模块（增量采集）
- [x] 前端基础框架
- [x] Docker 开发环境

### 🔄 进行中功能
- [ ] FastAPI API 层完善
- [ ] Agent 引擎集成
- [ ] 前端界面优化
- [ ] 性能测试和优化

### 📋 计划功能
- [ ] 用户认证系统
- [ ] 管理后台
- [ ] 数据可视化看板
- [ ] 多 LLM 供应商支持

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！贡献前请阅读：

1. **代码规范**：遵循 PEP 8 和项目代码风格
2. **测试要求**：新功能需包含单元测试
3. **文档更新**：相关文档需同步更新
4. **提交信息**：使用清晰的提交信息格式

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 📞 联系方式

- **项目仓库**：[https://github.com/Lineance/SEU-WuHub](https://github.com/Lineance/SEU-WuHub)
- **问题反馈**：[GitHub Issues](https://github.com/Lineance/SEU-WuHub/issues)
- **讨论区**：[GitHub Discussions](https://github.com/Lineance/SEU-WuHub/discussions)

---

*SEU-WuHub - 让校园信息触手可及*