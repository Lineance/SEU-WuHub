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

## Agent 对话接口

### 流式对话

```
POST /api/v1/chat/stream
```

**请求体**:
```json
{
  "query": "补考时间是什么时候",
  "session_id": "session-001",
  "history": [
    {
      "role": "user",
      "content": "我想了解教务通知"
    }
  ],
  "options": {
    "max_steps": 5
  }
}
```

**响应类型**:

- `Content-Type: text/event-stream`
- 采用 SSE 分块推送事件，事件类型包含：`thought`、`tool_call`、`tool_result`、`message`、`done`、`error`

**SSE 数据示例**:
```text
event: thought
data: {"type":"thought","step":1,"timestamp":"2026-03-31T12:00:00Z","payload":{"message":"正在分析问题并规划工具调用"}}

event: tool_call
data: {"type":"tool_call","step":1,"timestamp":"2026-03-31T12:00:00Z","payload":{"tool":"search_keyword","input":{"query":"补考时间是什么时候","limit":5}}}

event: message
data: {"type":"message","step":1,"timestamp":"2026-03-31T12:00:01Z","payload":{"content":"根据你的问题，我找到以下相关信息..."}}

event: done
data: {"type":"done","step":1,"timestamp":"2026-03-31T12:00:01Z","payload":{"reason":"completed"}}
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
