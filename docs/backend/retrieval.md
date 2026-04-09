# 检索模块说明

## 概述

检索模块 (`backend/retrieval/`) 负责从 LanceDB 中查询文章，支持向量搜索、全文搜索和混合搜索。

## 核心组件

### RetrievalEngine

主检索引擎类，位于 `backend/retrieval/engine.py`。

```python
from backend.retrieval.engine import RetrievalEngine

engine = RetrievalEngine()
results = engine.search(query="毕业", search_type="hybrid", limit=10)
```

### LanceStore

LanceDB 表操作封装，位于 `backend/retrieval/store.py`。

```python
from backend.retrieval.store import LanceStore

store = LanceStore()
# 向量搜索
results = store.vector_search(embedding=[...], limit=10)
# 全文搜索
results = store.fulltext_search(query="毕业设计", limit=10)
# 混合搜索
results = store.hybrid_search(query="毕业设计", limit=10)
```

## 搜索类型

| 类型 | 说明 | 适用场景 |
|------|------|----------|
| `vector` | 纯向量相似度搜索 | 语义理解需求 |
| `fulltext` | BM25 关键词搜索 | 精确匹配需求 |
| `hybrid` | RRF 融合两者结果 | 通用场景推荐 |

## 向量化模型

| 模型 | 维度 | 用途 |
|------|------|------|
| `paraphrase-multilingual-MiniLM-L12-v2` | 384 | 标题向量 |
| `BAAI/bge-large-zh-v1.5` | 1024 | 正文向量 |

## 查询向量化

```python
from backend.retrieval.utils.embedding import embed_query

# 自动选择模型（BGE 前缀处理）
embedding = embed_query("毕业设计答辩时间")
```

## RRF 融合算法

混合搜索使用 Reciprocal Rank Fusion (RRF) 融合向量和全文结果：

```
score = Σ 1 / (k + rank_i)
```

其中 k=60（默认）。

## 使用示例

```python
from backend.retrieval.engine import RetrievalEngine

engine = RetrievalEngine()

# 1. 混合搜索（推荐）
results = engine.search(
    query="教务处关于期末考试的通知",
    search_type="hybrid",
    limit=20
)

# 2. 仅向量搜索
results = engine.search(
    query="图书馆开放时间调整",
    search_type="vector",
    limit=10
)

# 3. 仅全文搜索
results = engine.search(
    query="奖学金申请",
    search_type="fulltext",
    limit=10
)

# 4. 带过滤条件
results = engine.search(
    query="补考",
    search_type="hybrid",
    limit=10,
    filters={
        "category": "教务通知",
        "tags": ["考试"],
        "start_date": "2026-01-01"
    }
)
```

## 索引配置

- **向量索引**: IVF-PQ（256 分区，64 子量化器）
- **全文索引**: Tantivy（内嵌 LanceDB）
- **索引字段**: `content_text`、`title`

## 性能优化

1. **预热查询**: 首次查询需要加载模型，后续查询更快
2. **批量查询**: 如需多次查询，准备好 Query 对象复用
3. **索引优化**: 大量数据时考虑重建索引
