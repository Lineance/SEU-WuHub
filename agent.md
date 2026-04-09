# Agent 工作规范

## 代码修复流程

每当完成一个代码修复后，必须执行以下步骤：

### 1. Git 提交
```bash
git add <修改的文件>
git commit -m "fix: <简短描述修复内容>

- <修复的具体问题>
- <涉及的文件>
"
```

### 2. 文档同步更新
如果修复涉及：
- API 接口变化 → 更新 `docs/backend/api.md`
- 数据模型变化 → 更新 `docs/backend/data-model.md`
- 模块行为变化 → 更新 `docs/backend/` 相关模块文档
- 架构变化 → 更新 `docs/ARCHITECTURE.md`

### 3. 提交规范
- 提交信息使用中文，简明扼要
- 每个 commit 聚焦单一问题
- 避免 "fix: 修复bug" 这样的模糊信息

## 示例

修复了搜索接口分页问题：
```bash
git add backend/app/api/v1/search.py
git commit -m "fix: 修复搜索接口分页参数错误

- 修复 limit 参数未正确传递给检索引擎
- 更新 docs/backend/api.md 分页说明
"
```

## 文档位置

```
docs/
├── ARCHITECTURE.md      # 整体架构文档
├── DEPLOYMENT.md        # 部署指南
├── MODULE_INTEGRATION.md # 模块集成说明
└── backend/
    ├── api.md           # API 接口文档
    ├── retrieval.md     # 检索模块说明
    ├── crawler.md       # 爬虫模块说明
    └── data-model.md    # 数据模型文档
```

## 目录结构规范

### 数据库位置
- **后端数据层**: `backend/database/`
  - `backend/database/repository.py` - 数据访问层
  - `backend/database/schema.py` - 表结构定义
  - `backend/database/connection.py` - LanceDB 连接管理
  - `backend/database/tag_repository.py` - 标签存储

- **测试数据**: `backend/tests/database/`

- **LanceDB 数据文件**: `data/`（项目根目录，存储 .lance 数据文件）

### 配置文件位置
- **全局配置**: `config/`
  - `config/websites/` - 爬虫网站配置 (YAML)
  - `config/tags.yaml` - 标签定义

- **后端环境变量**: `backend/.env.example`

### 导入规范
```python
# ✅ 正确
from backend.database.repository import ArticleRepository
from backend.database.schema import ArticleFields
from backend.retrieval.engine import RetrievalEngine

# ❌ 错误
from backend.data.repository import ArticleRepository  # data 已改名为 database
from backend.retrieval.store import LanceStore  # 应使用完整路径
```

> **注意**: 修改任何导入路径后，必须同步更新相关文档。

## 测试命令

### 运行所有测试

```bash
cd d:/SEU-WuHub
PYTHONPATH=d:/SEU-WuHub python -m pytest backend/tests/ --cov --cov-fail-under=0 -q
```

### 运行真实浏览器测试

```bash
cd d:/SEU-WuHub
PYTHONPATH=d:/SEU-WuHub python -m pytest backend/tests/ --run-real-web --cov --cov-fail-under=0 -q
```

### 快速测试（无覆盖率）

```bash
cd d:/SEU-WuHub
PYTHONPATH=d:/SEU-WuHub python -m pytest backend/tests/ --no-cov -q
```

### 运行特定模块测试

```bash
cd d:/SEU-WuHub
PYTHONPATH=d:/SEU-WuHub python -m pytest backend/tests/api/ --no-cov -q
PYTHONPATH=d:/SEU-WuHub python -m pytest backend/tests/crawler/ --run-real-web --no-cov -q
```
