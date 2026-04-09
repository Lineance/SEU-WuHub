# 数据模型文档

## LanceDB Schema

文章数据存储在 LanceDB 中，表名 `articles`。

### 字段定义

| 字段 | 类型 | 说明 |
|------|------|------|
| `news_id` | string | 主键，唯一标识 |
| `title` | string | 文章标题 |
| `publish_date` | timestamp | 发布日期 |
| `url` | string | 原文链接 |
| `source_site` | string | 来源站点 |
| `author` | string | 作者/发布者 |
| `tags` | list[string] | 标签列表 |
| `content_markdown` | string | Markdown 格式内容 |
| `content_text` | string | 纯文本内容（用于向量化） |
| `title_embedding` | list[float32](384) | 标题向量（BGE-MiniLM） |
| `content_embedding` | list[float32](1024) | 正文向量（BGE-Large） |
| `crawl_version` | int | 爬取版本号 |
| `last_updated` | timestamp | 最后更新时间 |
| `metadata` | string (JSON) | 扩展元数据 |
| `attachments` | list[string] | PDF 等附件链接 |

### 主键

`news_id` 由 URL 哈希生成，确保唯一性：

```python
import hashlib

def generate_news_id(url: str) -> str:
    return hashlib.md5(url.encode()).hexdigest()[:16]
```

## Pydantic Schema

### Backend (Python)

位于 `backend/app/schemas/`：

```python
from backend.app.schemas.article import ArticleResponse, ArticleCreate

# 文章响应
article = ArticleResponse(
    id="abc123",
    title="关于2026年春季学期选课通知",
    url="https://jwc.seu.edu.cn/xxx.html",
    content="...",
    published_date="2026-03-01",
    tags=["选课", "教务"],
    category="教务通知"
)
```

### Frontend (TypeScript)

位于 `frontend/src/lib/types.ts`：

```typescript
interface Article {
  id: string
  title: string
  url: string
  content?: string
  summary?: string
  author?: string
  published_at?: string
  tags: string[]
  category?: string
  source?: string
}
```

## 数据流向

```
爬虫采集 (Crawl4AI)
    ↓
原始 HTML/Markdown
    ↓
Ingestion Pipeline
    ├── 验证 (DocumentValidator)
    ├── 标准化 (normalize_content)
    ├── 去重 (DuplicateDetector)
    ├── 向量化 (Embedder)
    └── 标签匹配 (TagMatcher)
    ↓
LanceDB (articles 表)
    ↓
检索引擎 (RetrievalEngine)
    ↓
API 接口 (/api/v1/articles, /api/v1/search)
    ↓
前端展示
```

## 向量化字段

### 标题向量
- **模型**: `paraphrase-multilingual-MiniLM-L12-v2`
- **维度**: 384
- **用途**: 短文本语义匹配

### 正文向量
- **模型**: `BAAI/bge-large-zh-v1.5`
- **维度**: 1024
- **用途**: 长文本语义理解

## 标签系统

标签预定义在 `config/tags.yaml`，支持自动匹配：

```yaml
tags:
  - name: "教务通知"
    description: "教务处相关通知"
    keywords: ["选课", "考试", "成绩"]
  - name: "图书馆"
    description: "图书馆通知"
    keywords: ["借阅", "开放时间", "资源"]
```

文章入库时，通过向量相似度自动分配标签。
