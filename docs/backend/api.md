# API 接口文档

## 基础信息

- **Base URL**: `/api/v1`
- **Content-Type**: `application/json`
- **认证**: 暂无（公网只读）

## 文章接口

### 获取文章列表

```http
GET /api/v1/articles
```

**Query Parameters**

| 参数        | 类型              | 默认值 | 说明                                       |
| ----------- | ----------------- | ------ | ------------------------------------------ |
| `page`      | int               | 1      | 页码                                       |
| `page_size` | int               | 20     | 每页数量                                   |
| `source`    | string            | -      | 来源筛选                                   |
| `tags`      | string / string[] | -      | 标签筛选；GET 请求中通常使用逗号分隔字符串 |

**响应**

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
      "source": "string"
    }
  ],
  "total": 100,
  "page": 1,
  "page_size": 20,
  "total_pages": 5
}
```

### 获取文章详情

```http
GET /api/v1/articles/{id}
```

**响应**

```json
{
  "id": "string",
  "title": "string",
  "url": "string",
  "content": "string",
  "summary": "string",
  "author": "string",
  "published_date": "string",
  "tags": ["string"],
  "source": "string",
  "attachments": ["string"],
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

> 说明：后端详情接口返回正文字段 `content`。前端展示时可能会将其映射为 `content_md` 进行 Markdown 渲染。

### 创建文章

```http
POST /api/v1/articles
```

**请求体**

```json
{
  "title": "string",
  "url": "string",
  "content": "string",
  "author": "string",
  "published_date": "string",
  "tags": ["string"],
  "source": "string"
}
```

### 更新文章

```http
PUT /api/v1/articles/{id}
```

### 删除文章

```http
DELETE /api/v1/articles/{id}
```

## 搜索接口

### 搜索文章（POST）

```http
POST /api/v1/search
```

**请求体**

```json
{
  "query": "string",
  "limit": 10,
  "source": "string",
  "tags": ["string"],
  "start_date": "string",
  "end_date": "string"
}
```

**响应**

```json
{
  "results": [
    {
      "id": "string",
      "title": "string",
      "url": "string",
      "summary": "string",
      "score": 0.95,
      "source": "string",
      "tags": ["string"],
      "published_date": "string"
    }
  ],
  "total": 100,
  "query": "string"
}
```

### 搜索文章（GET）

```http
GET /api/v1/search?q=<query>&limit=10&source=<source>&tags=<tag1,tag2>
```

**Query Parameters**

| 参数         | 类型   | 默认值 | 说明                   |
| ------------ | ------ | ------ | ---------------------- |
| `q`          | string | -      | 搜索关键词             |
| `limit`      | int    | 20     | 返回结果数量           |
| `source`     | string | -      | 来源筛选               |
| `tags`       | string | -      | 标签筛选，逗号分隔     |
| `start_date` | string | -      | 开始日期（YYYY-MM-DD） |
| `end_date`   | string | -      | 结束日期（YYYY-MM-DD） |

GET 与 POST 搜索接口返回结构一致。

## 元数据接口

### 获取搜索与导航元数据

```http
GET /api/v1/metadata
```

**响应**

```json
{
  "categories": [
    {
      "id": "string",
      "name": "string",
      "description": "string"
    }
  ],
  "tags": {
    "category_id": [
      {
        "id": "string",
        "name": "string",
        "description": "string",
        "priority": 1,
        "is_manual": true
      }
    ]
  },
  "sources": ["string"],
  "navigation": [
    {
      "id": "string",
      "name": "string",
      "icon": "string",
      "type": "string"
    }
  ]
}
```

## Agent 对话接口

### 流式对话

```http
POST /api/v1/chat/stream
```

**请求体**

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

**响应类型**

- `Content-Type: text/event-stream`
- 采用 SSE 分块推送事件，事件类型包含：`thought`、`tool_call`、`tool_result`、`message`、`done`、`error`

**SSE 数据示例**

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

### 自动生成对话标题

```http
POST /api/v1/chat/title
```

**请求体**

```json
{
  "content": "请根据这段对话内容生成一个简短标题"
}
```

## 健康检查

```http
GET /health
```

**响应**

```json
{
  "status": "healthy",
  "version": "string",
  "database": "ok"
}
```
