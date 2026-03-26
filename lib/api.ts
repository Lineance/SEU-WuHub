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
  }): Promise<SearchResponse> => {
    const searchParams = new URLSearchParams({ q: params.query })
    if (params.limit) searchParams.set('limit', String(params.limit))
    if (params.category) searchParams.set('category', params.category)
    if (params.tags) searchParams.set('tags', params.tags.join(','))

    return fetchApi<SearchResponse>(`/search/?${searchParams.toString()}`)
  },
}

// Health check
export const healthApi = {
  check: (): Promise<{ status: string; version: string; database: string }> => {
    return fetchApi<{ status: string; version: string; database: string }>('/health')
  },
}

export type { Article, ArticleListResponse, SearchResult, SearchResponse }
