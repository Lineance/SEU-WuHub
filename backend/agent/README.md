# Agent 模块说明

## 模块定位

本目录为 SEU-WuHub 智能 Agent 实现，负责多轮对话、工具编排、LLM 推理与流式事件输出。

- 支持 ReAct 多步推理（Thought → ToolCall → ToolResult → Finish）
- 工具注册与动态调用（如搜索、SQL、网页抓取等）
- LLM/规则混合决策，支持回退
- SSE 流式输出，前端可实时消费

## 目录结构

- `core/`：Agent 主循环、决策与事件流
- `llm/`：LLM 客户端与 planner
- `events/`：事件类型、SSE 封装
- `memory/`：对话上下文缓存
- `tools/`：工具注册与协议
- `prompts/`：提示词模板
- `config.py`：Agent 配置

## 快速使用

1. **依赖安装**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **配置 LLM API**
   - Agent 通过 [LiteLLM](https://github.com/BerriAI/litellm) 统一调用主流大模型（OpenAI、Azure、Moonshot、百川、Qwen、GLM等）。
   - **环境变量配置**（推荐写入 `.env` 或 `.env.local`）：
     ```env
     # OpenAI 官方API
     LITELLM_API_KEY=sk-xxx
     SEU_WUHUB_AGENT_MODEL=openai/gpt-4o-mini
     # Azure OpenAI
     # LITELLM_API_TYPE=azure
     # LITELLM_API_BASE=https://xxx.openai.azure.com/
     # LITELLM_API_KEY=azure-key
     # SEU_WUHUB_AGENT_MODEL=azure/gpt-35-turbo
     ```
   - 更多云厂商/模型配置见 [litellm官方文档](https://github.com/BerriAI/litellm#supported-models)。
   - 运行参数（如 temperature、max_tokens、timeout）可在 `config.py` 调整。
   - 示例配置见 `agent/.env.example`。

3. **集成方式**
   - FastAPI 路由已在 `app/api/v1/chat.py` 注册 `/api/v1/chat/stream`。
   - 前端通过 POST `/api/v1/chat/stream` 发送问题，流式消费事件。

4. **事件类型**
   - `thought`：思考/规划
   - `tool_call`：工具调用
   - `tool_result`：工具结果
   - `warning`：降级/回退提示
   - `message`：最终答案
   - `done`：流程结束
   - `error`：异常

5. **自定义工具**
   - 实现 `ToolProtocol` 并注册到 `ToolRegistry`
   - 参考 `tools/search.py`、`tools/sql.py`

## 典型调用流程

1. 用户提问，Agent 记录上下文
2. LLM/规则决策工具与参数
3. 工具执行，结果回写 memory
4. 多步循环，直到 finish 或超步
5. LLM 汇总 observation 生成最终答案
6. 事件流推送至前端

## 测试

```bash
cd backend
pytest tests/agent
```

## 常见问题

- LLM 无法调用：检查 API KEY 与网络
- 工具注册失败：确认实现 ToolProtocol 并正确注册
- SSE 不流式：确认前端 fetch/readStream 实现

## 参考文档
- [docs/backend/api.md](../../docs/backend/api.md)
- [docs/MODULE_INTEGRATION.md](../../docs/MODULE_INTEGRATION.md)
- [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md)
