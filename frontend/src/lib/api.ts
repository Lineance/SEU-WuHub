/**
 * API Client for SEU-WuHub Backend
 *
 * Provides typed API calls to the backend FastAPI service.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api/v1'

interface Article {
  id: string
  title: string
  url: string
  content?: string
  summary?: string
  author?: string
  published_date?: string
  tags: string[]
  category?: string
  attachments?: string[]
}

interface ArticleListResponse {
  items: Article[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

interface SearchResult {
  id: string
  title: string
  url: string
  summary?: string
  score: number
  category?: string
  tags: string[]
  published_date?: string
}

interface SearchResponse {
  query: string
  results: SearchResult[]
  total: number
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE}${endpoint}`

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    })

    if (!response.ok) {
      throw new ApiError(response.status, await response.text())
    }

    return response.json()
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    throw new Error(`Network error: ${error}`)
  }
}

// Article API
export const articleApi = {
  list: (params?: {
    page?: number
    page_size?: number
    category?: string
    tags?: string
  }): Promise<ArticleListResponse> => {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.page_size) searchParams.set('page_size', String(params.page_size))
    if (params?.category) searchParams.set('category', params.category)
    if (params?.tags) searchParams.set('tags', params.tags)

    const query = searchParams.toString()
    return fetchApi<ArticleListResponse>(`/articles/${query ? `?${query}` : ''}`)
  },

  get: (id: string): Promise<Article> => {
    return fetchApi<Article>(`/articles/${id}`)
  },

  create: (data: Partial<Article>): Promise<Article> => {
    return fetchApi<Article>('/articles/', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  update: (id: string, data: Partial<Article>): Promise<Article> => {
    return fetchApi<Article>(`/articles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  delete: (id: string): Promise<void> => {
    return fetchApi<void>(`/articles/${id}`, {
      method: 'DELETE',
    })
  },
}

// Search API
export const searchApi = {
  search: (params: {
    query: string
    limit?: number
    category?: string
    tags?: string[]
    start_date?: string
    end_date?: string
  }): Promise<SearchResponse> => {
    const searchParams = new URLSearchParams({ q: params.query })
    if (params.limit) searchParams.set('limit', String(params.limit))
    if (params.category) searchParams.set('category', params.category)
    if (params.tags) searchParams.set('tags', params.tags.join(','))
    if (params.start_date) searchParams.set('start_date', params.start_date)
    if (params.end_date) searchParams.set('end_date', params.end_date)

    return fetchApi<SearchResponse>(`/search/?${searchParams.toString()}`)
  },
}

// Health check
export const healthApi = {
  check: (): Promise<{ status: string; version: string; database: string }> => {
    return fetchApi<{ status: string; version: string; database: string }>('/health')
  },
}

export type { Article, ArticleListResponse, SearchResponse, SearchResult }

export interface SearchArticlesParams {
  q?: string
  page?: number
  page_size?: number
  time?: string
  start_date?: string
  end_date?: string
  source?: string
  tag?: string
  date?: string
  exact?: boolean
}

export interface SearchQueryParams {
  query: string
  limit?: number
  start_date?: string
  end_date?: string
  category?: string
  tags?: string[]
}

export function buildSearchQueryParams(params: SearchArticlesParams): SearchQueryParams {
  let start_date = params.start_date
  let end_date = params.end_date

  if (params.time && !start_date && !end_date) {
    const now = new Date()
    const timeMap: Record<string, number> = {
      today: 1,
      '7days': 7,
      '30days': 30,
      '6months': 180,
      '1year': 365,
    }
    const days = timeMap[params.time]
    if (days) {
      const d = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
      start_date = d.toISOString().split('T')[0]
      end_date = now.toISOString().split('T')[0]
    }
  }

  if (params.date && !start_date && !end_date) {
    start_date = params.date
    end_date = params.date
  }

  return {
    query: params.q || '',
    limit: params.page_size || 20,
    start_date,
    end_date,
    category: params.source,
    tags: params.tag ? [params.tag] : undefined,
  }
}

export function buildSearchParams(params: {
  page?: number
  page_size?: number
  category?: string
  tags?: string
}): URLSearchParams {
  const searchParams = new URLSearchParams()
  if (params.page) searchParams.set('page', String(params.page))
  if (params.page_size) searchParams.set('page_size', String(params.page_size))
  if (params.category) searchParams.set('category', params.category)
  if (params.tags) searchParams.set('tags', params.tags)
  return searchParams
}

export function buildSearchUrlParams(params: SearchArticlesParams): URLSearchParams {
  const queryParams = buildSearchQueryParams(params)
  const searchParams = new URLSearchParams({ q: queryParams.query })
  if (queryParams.limit) searchParams.set('limit', String(queryParams.limit))
  if (queryParams.start_date) searchParams.set('start_date', queryParams.start_date)
  if (queryParams.end_date) searchParams.set('end_date', queryParams.end_date)
  return searchParams
}

// Categories API - 从文章数据中提取分类
export const categoriesApi = {
  getCategories: async (): Promise<{ data: Array<{ id: string; name: string; count: number }> }> => {
    // 从后端获取所有文章并提取分类
    const response = await articleApi.list({ page_size: 100 })
    const categoryMap = new Map<string, number>()

    for (const article of response.items) {
      const category = article.category || "未分类"
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1)
    }

    const data = Array.from(categoryMap.entries()).map(([name, count]) => ({
      id: name,
      name,
      count,
    }))

    return { data }
  },
}

// AI Chat API
export const aiApi = {
  chatWithAI: async (query: string, history: any[]) => {
    const url = `${API_BASE}/chat/stream`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        history,
      }),
    })

    if (!response.ok) {
      throw new ApiError(response.status, await response.text())
    }

    if (!response.body) {
      throw new Error('No response body')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    const normalizeEvent = (raw: any) => {
      if (!raw || typeof raw !== 'object') return null
      const eventType = String(raw.type || '')
      const payload = (raw.payload && typeof raw.payload === 'object') ? raw.payload : {}

      if (eventType === 'thought') {
        return { type: 'thought', content: String(payload.message || '') }
      }
      if (eventType === 'tool_call') {
        return { type: 'tool_call', tool_name: String(payload.tool || '') }
      }
      if (eventType === 'tool_result') {
        return { type: 'tool_response', content: payload.result }
      }
      if (eventType === 'message') {
        return {
          type: 'answer',
          content: String(payload.content || ''),
          sources: Array.isArray(payload.sources) ? payload.sources : [],
        }
      }
      if (eventType === 'done') {
        return {
          type: 'done',
          reason: String(payload.reason || ''),
          sources: Array.isArray(payload.sources) ? payload.sources : [],
        }
      }

      // Backward compatibility: if upstream already sends frontend-ready events.
      return raw
    }

    return {
      async *[Symbol.asyncIterator]() {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // 分割消息 - SSE 事件以空行分隔
          const messages = buffer.split('\\n\\n')
          buffer = messages.pop() || ''

          for (const message of messages) {
            const lines = message.split('\\n')
            let dataStr = ''

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                dataStr = line.slice(6).trim()
              }
            }

            if (dataStr) {
              try {
                const normalized = normalizeEvent(JSON.parse(dataStr))
                if (normalized) {
                  yield normalized
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', dataStr, e)
              }
            }
          }
        }

        // 处理最后残留的数据
        if (buffer) {
          const lines = buffer.split('\\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6).trim()
              if (dataStr) {
                try {
                  const normalized = normalizeEvent(JSON.parse(dataStr))
                  if (normalized) {
                    yield normalized
                  }
                } catch (e) {
                  console.error('Failed to parse final SSE data:', dataStr, e)
                }
              }
            }
          }
        }
      },
    }
  },
}

// 默认导出
export const api = {
  article: articleApi,
  search: searchApi,
  health: healthApi,
  ai: aiApi,
  getCategories: categoriesApi.getCategories,
  getArticles: async (params: { category_id?: string; page?: number; page_size?: number }) => {
    // 将 category_id 转换为 category 以匹配后端 API
    const response = await articleApi.list({ page: params.page, page_size: params.page_size, category: params.category_id ? decodeURIComponent(params.category_id) : undefined })
    // 转换格式以匹配前端期望的结构
    const transformedItems = response.items.map(item => ({
      id: item.id,
      title: item.title,
      summary: item.summary || item.content?.slice(0, 200) || "",
      published_at: item.published_date,
      source: item.category,
      tags: item.tags || [],
      url: item.url,
    }))
    return {
      data: transformedItems,
      pagination: {
        total_pages: response.total_pages,
        total: response.total,
        page: response.page,
      },
    }
  },
  searchArticles: async (params: SearchArticlesParams) => {
    const queryParams = buildSearchQueryParams(params)
    const response = await searchApi.search(queryParams)
    // 去除 HTML 标签并映射字段
    const stripHtml = (html: string) => html ? html.replace(/<[^>]*>/g, '').slice(0, 200) : ''
    const data = response.results.map(r => ({
      id: r.id,
      title: r.title,
      summary: stripHtml(r.summary || ''),
      published_at: r.published_date,
      source: r.category,
      tags: r.tags || [],
      url: r.url,
    }))
    return {
      data,
      pagination: {
        total_pages: Math.ceil(response.total / (params.page_size || 20)),
        total: response.total,
        page: params.page || 1,
      },
    }
  },
  getArticleDetail: async (id: string) => {
    const response = await articleApi.get(id)
    return {
      data: {
        id: response.id,
        title: response.title,
        content_md: response.content || "",  // Markdown content for ReactMarkdown
        summary: response.summary || "",
        published_at: response.published_date,
        source: response.category,
        source_url: response.url,
        tags: response.tags || [],
        url: response.url,
        attachments: (response as any).attachments || [],
      },
    }
  },
  chatWithAI: aiApi.chatWithAI,
  generateTitle: async (content: string) => {
    const url = `${API_BASE}/chat/title`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    })

    if (!response.ok) {
      throw new ApiError(response.status, await response.text())
    }

    return response.json()
  },
}
