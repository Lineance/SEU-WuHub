/**
 * API Client - Backend API communication layer
 *
 * Responsibilities:
 * - Base URL configuration
 * - Request/Response interceptors
 * - Type-safe API methods
 */

import type {
  Article,
  ArticleDetail,
  ApiResponse,
  Category,
  ChatContext,
  Pagination,
} from "./types"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message)
    this.name = "ApiError"
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new ApiError(
      errorData.message || `HTTP error ${response.status}`,
      response.status,
      errorData
    )
  }
  return response.json()
}

function buildUrl(endpoint: string, params?: Record<string, string | number | undefined>) {
  const url = new URL(endpoint, API_BASE_URL)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value))
      }
    })
  }
  return url.toString()
}

export const api = {
  /**
   * Get paginated list of articles
   */
  async getArticles(params: {
    page?: number
    page_size?: number
    source?: string
  }): Promise<ApiResponse<Article[]>> {
    const url = buildUrl("/api/v1/articles", params)
    const response = await fetch(url)
    return handleResponse<ApiResponse<Article[]>>(response)
  },

  /**
   * Get article detail by ID
   */
  async getArticleDetail(articleId: string): Promise<ApiResponse<ArticleDetail>> {
    const response = await fetch(buildUrl(`/api/v1/articles/${encodeURIComponent(articleId)}`))
    return handleResponse<ApiResponse<ArticleDetail>>(response)
  },

  /**
   * Get list of categories
   */
  async getCategories(): Promise<ApiResponse<Category[]>> {
    const response = await fetch(buildUrl("/api/v1/categories"))
    return handleResponse<ApiResponse<Category[]>>(response)
  },

  /**
   * Search articles
   */
  async searchArticles(params: {
    q: string
    page?: number
    page_size?: number
  }): Promise<ApiResponse<Article[]>> {
    const url = buildUrl("/api/v1/search", params)
    const response = await fetch(url)
    return handleResponse<ApiResponse<Article[]>>(response)
  },

  /**
   * Get chat history
   */
  async getChatHistory(sessionId: string): Promise<ApiResponse<unknown[]>> {
    const url = buildUrl("/api/v1/chat/history", { session_id: sessionId })
    const response = await fetch(url)
    return handleResponse<ApiResponse<unknown[]>>(response)
  },

  /**
   * Create SSE connection for chat streaming
   */
  createChatStream(
    query: string,
    sessionId?: string,
    onChunk?: (chunk: ChatContext[]) => void,
    onContext?: (context: ChatContext[]) => void,
    onDone?: () => void,
    onError?: (error: Error) => void
  ): { eventSource: EventSource; sessionId: string } {
    const params = new URLSearchParams({ q: query })
    if (sessionId) {
      params.append("session_id", sessionId)
    }

    const url = `${API_BASE_URL}/api/v1/chat/stream?${params.toString()}`
    const eventSource = new EventSource(url)
    let currentSessionId = sessionId || ""
    let buffer = ""

    eventSource.addEventListener("chunk", (event) => {
      try {
        const data = JSON.parse(event.data)
        buffer += data.content
        onChunk?.(buffer)
      } catch (e) {
        console.error("Failed to parse chunk:", e)
      }
    })

    eventSource.addEventListener("context", (event) => {
      try {
        const data = JSON.parse(event.data) as ChatContext[]
        onContext?.(data)
      } catch (e) {
        console.error("Failed to parse context:", e)
      }
    })

    eventSource.addEventListener("done", (event) => {
      try {
        const data = JSON.parse(event.data)
        currentSessionId = data.session_id || currentSessionId
        onDone?.()
      } catch (e) {
        console.error("Failed to parse done event:", e)
      }
    })

    eventSource.addEventListener("error", (event) => {
      const error = new Error("SSE connection error")
      onError?.(error)
      eventSource.close()
    })

    // Override onopen to get session ID from headers
    const originalOnOpen = eventSource.onopen
    eventSource.onopen = (event) => {
      // Session ID is set in X-Session-ID header by the server
      const headers = (event as unknown as {target: EventSource & {headers?: Record<string, string>}}).target
      if (headers?.headers?.["x-session-id"]) {
        currentSessionId = headers.headers["x-session-id"]
      }
      originalOnOpen?.call(eventSource, event)
    }

    return { eventSource, sessionId: currentSessionId }
  },
}

export type { ChatContext }
