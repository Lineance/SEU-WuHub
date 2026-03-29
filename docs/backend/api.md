# API 接口文档

## 基础信息

- **Base URL**: `/api/v1`
- **Content-Type**: `application/json`
- **认证**: 暂无（公网只读）

## 文章接口

### 获取文章列表

```
GET /api/v1/articles
```

**Query Parameters**:
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page` | int | 1 | 页码 |
| `page_size` | int | 20 | 每页数量 |
| `category` | string | - | 分类筛选 |
| `tags` | string[] | - | 标签筛选 |
| `start_date` | string | - | 开始日期 (YYYY-MM-DD) |
| `end_date` | string | - | 结束日期 (YYYY-MM-DD) |

**响应**:
```json
{
  "items": [
    {
      "id": "string",
      "title": "string",
      "url": "string",
      "summary": "string",
      "published_date": "string",
      "tags": ["string"],
      "category": "string",
      "source": "string"
    }
  ],
  "total": 100,
  "page": 1,
  "page_size": 20
}
```

### 获取文章详情

```
GET /api/v1/articles/{id}
```

**响应**:
```json
{
  "id": "string",
  "title": "string",
  "url": "string",
  "content": "string",
  "content_md": "string",
  "summary": "string",
  "author": "string",
  "published_date": "string",
  "tags": ["string"],
  "category": "string",
  "attachments": ["string"],
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### 创建文章

```
POST /api/v1/articles
```

**请求体**:
```json
{
  "title": "string",
  "url": "string",
  "content": "string",
  "author": "string",
  "published_date": "string",
  "tags": ["string"],
  "category": "string"
}
```

### 更新文章

```
PUT /api/v1/articles/{id}
```

### 删除文章

```
DELETE /api/v1/articles/{id}
```

## 搜索接口

### 搜索文章

```
POST /api/v1/search
```

**请求体**:
```json
{
  "query": "string",
  "limit": 10,
  "category": "string",
  "tags": ["string"],
  "start_date": "string",
  "end_date": "string"
}
```

**响应**:
```json
{
  "results": [
    {
      "id": "string",
      "title": "string",
      "url": "string",
      "summary": "string",
      "score": 0.95,
      "highlights": ["string"]
    }
  ],
  "total": 100,
  "query": "string"
}
```

### GET 搜索

```
GET /api/v1/search?q=<query>&limit=10
```

## 健康检查

```
GET /health
```

**响应**:
```json
{
  "status": "healthy",
  "timestamp": "datetime"
}
```
