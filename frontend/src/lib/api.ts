/**
 * API Client for SEU-WuHub Backend
 *
 * Provides typed API calls to the backend FastAPI service.
 */

const API_PREFIX = '/api/v1'

function normalizeApiBase(rawBase: string): string {
  const trimmed = rawBase.trim()
  if (!trimmed) return API_PREFIX

  if (trimmed.startsWith('/')) {
    const normalized = trimmed.replace(/\/+$/, '')
    if (normalized === API_PREFIX || normalized.endsWith(API_PREFIX)) {
      return normalized
    }
    return `${normalized}${API_PREFIX}`
  }

  try {
    const parsed = new URL(trimmed)
    const pathname = parsed.pathname.replace(/\/+$/, '')
    if (!pathname || pathname === '') {
      parsed.pathname = API_PREFIX
    } else if (!pathname.endsWith(API_PREFIX)) {
      parsed.pathname = `${pathname}${API_PREFIX}`
    }
    return parsed.toString().replace(/\/+$/, '')
  } catch {
    return API_PREFIX
  }
}

function shouldUseRelativeApiBase(apiBase: string): boolean {
  if (typeof window === 'undefined') return false
  if (apiBase.startsWith('/')) return false

  try {
    const parsed = new URL(apiBase)
    // Browser cannot resolve Docker internal hostnames like "backend".
    return parsed.hostname === 'backend'
  } catch {
    return true
  }
}

const configuredBase = normalizeApiBase(process.env.NEXT_PUBLIC_API_URL || '')
const API_BASE = shouldUseRelativeApiBase(configuredBase) ? API_PREFIX : configuredBase
const API_FALLBACK_BASE = API_PREFIX

function buildApiUrl(base: string, endpoint: string): string {
  return `${base}${endpoint}`
}

async function fetchWithFallback(
  endpoint: string,
  options?: RequestInit
): Promise<Response> {
  const primaryUrl = buildApiUrl(API_BASE, endpoint)
  const fallbackUrl = buildApiUrl(API_FALLBACK_BASE, endpoint)
  const canFallback = fallbackUrl !== primaryUrl

  try {
    const response = await fetch(primaryUrl, options)
    if (canFallback && [404, 502, 503, 504].includes(response.status)) {
      return fetch(fallbackUrl, options)
    }
    return response
  } catch (primaryError) {
    if (!canFallback) {
      throw primaryError
    }
    return fetch(fallbackUrl, options)
  }
}

interface Article {
  id: string
  title: string
  url: string
  content?: string
  summary?: string
  author?: string
  published_date?: string
  tags: string[]
  source?: string
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
  source?: string
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
  try {
    const response = await fetchWithFallback(endpoint, {
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
    source?: string
    tags?: string
  }): Promise<ArticleListResponse> => {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.page_size) searchParams.set('page_size', String(params.page_size))
    if (params?.source) searchParams.set('source', params.source)
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
    page?: number
    source?: string
    tags?: string[]
    start_date?: string
    end_date?: string
  }): Promise<SearchResponse> => {
    const searchParams = new URLSearchParams({ q: params.query })
    if (params.limit) searchParams.set('limit', String(params.limit))
    if (params.page) searchParams.set('page', String(params.page))
    if (params.source) searchParams.set('source', params.source)
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

export interface MetadataResponse {
  categories: Array<{ id: string; name: string; description: string }>
  tags: Record<string, Array<{ id: string; name: string; description: string; priority: number; is_manual?: boolean }>>
  sources: string[]
  navigation: Array<{ id: string; name: string; icon: string; type: string }>
}

export interface SearchArticlesParams {
  q?: string
  page?: number
  page_size?: number
  time?: string
  start_date?: string
  end_date?: string
  source?: string
  tags?: string
  date?: string
  exact?: boolean
}

export interface SearchQueryParams {
  query: string
  limit?: number
  page?: number
  start_date?: string
  end_date?: string
  source?: string
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
    page: params.page,
    start_date,
    end_date,
    source: params.source,
    tags: params.tags ? params.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
  }
}

export function buildSearchParams(params: {
  page?: number
  page_size?: number
  source?: string
  tags?: string
}): URLSearchParams {
  const searchParams = new URLSearchParams()
  if (params.page) searchParams.set('page', String(params.page))
  if (params.page_size) searchParams.set('page_size', String(params.page_size))
  if (params.source) searchParams.set('source', params.source)
  if (params.tags) searchParams.set('tags', params.tags)
  return searchParams
}

export function buildSearchUrlParams(params: SearchArticlesParams): URLSearchParams {
  const queryParams = buildSearchQueryParams(params)
  const searchParams = new URLSearchParams({ q: queryParams.query })
  if (queryParams.limit) searchParams.set('limit', String(queryParams.limit))
  if (queryParams.start_date) searchParams.set('start_date', queryParams.start_date)
  if (queryParams.end_date) searchParams.set('end_date', queryParams.end_date)
  if (queryParams.source) searchParams.set('source', queryParams.source)
  if (queryParams.tags) searchParams.set('tags', queryParams.tags.join(','))
  if (params.page) searchParams.set('page', String(params.page))
  if (params.exact) searchParams.set('exact', 'true')
  return searchParams
}

// Categories API - 从文章数据中提取分类
export const categoriesApi = {
  getCategories: async (): Promise<{ data: Array<{ id: string; name: string; count: number }> }> => {
    const response = await articleApi.list({ page_size: 100 })
    const categoryMap = new Map<string, number>()

    for (const article of response.items) {
      const source = article.source || "未分类"
      categoryMap.set(source, (categoryMap.get(source) || 0) + 1)
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
    const response = await fetchWithFallback('/chat/stream', {
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

    const normalizeChunk = (chunk: string) => chunk.replace(/\r\n/g, '\n')

    const extractDataPayload = (eventBlock: string): string => {
      const dataLines: string[] = []
      const lines = eventBlock.split('\n')

      for (const line of lines) {
        if (line.startsWith('data:')) {
          const value = line.slice(5)
          dataLines.push(value.startsWith(' ') ? value.slice(1) : value)
        }
      }

      return dataLines.join('\n').trim()
    }

    const normalizeEvent = (raw: any) => {
      if (!raw || typeof raw !== 'object') return null
      const eventType = String(raw.type || '')
      const payload = (raw.payload && typeof raw.payload === 'object') ? raw.payload : {}

      if (eventType === 'thought') {
        return { type: 'thought', content: String(payload.message || ''), step: raw.step ?? 0 }
      }
      if (eventType === 'tool_call') {
        return { type: 'tool_call', tool_name: String(payload.tool || ''), step: raw.step ?? 0 }
      }
      if (eventType === 'tool_result') {
        return { type: 'tool_response', content: payload.result, step: raw.step ?? 0 }
      }
      if (eventType === 'message') {
        return {
          type: 'answer',
          content: String(payload.content || ''),
          sources: Array.isArray(payload.sources) ? payload.sources : [],
          step: raw.step ?? 0,
        }
      }
      if (eventType === 'done') {
        return {
          type: 'done',
          reason: String(payload.reason || ''),
          sources: Array.isArray(payload.sources) ? payload.sources : [],
          step: raw.step ?? 0,
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

          buffer += normalizeChunk(decoder.decode(value, { stream: true }))

          // 分割消息 - SSE 事件以空行分隔
          const messages = buffer.split('\n\n')
          buffer = messages.pop() || ''

          for (const message of messages) {
            const dataStr = extractDataPayload(message)

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
          const finalData = extractDataPayload(normalizeChunk(buffer))
          if (finalData) {
            try {
              const normalized = normalizeEvent(JSON.parse(finalData))
              if (normalized) {
                yield normalized
              }
            } catch (e) {
              console.error('Failed to parse final SSE data:', finalData, e)
            }
          }
        }
      },
    }
  },
}

// 标签 ID <-> 名称映射缓存
let tagIdToNameCache: Map<string, string> | null = null
let tagNameToIdCache: Map<string, string> | null = null
let tagCachePromise: Promise<void> | null = null

async function loadTagMappings(): Promise<void> {
  if (tagCachePromise) return tagCachePromise

  tagCachePromise = (async () => {
    const idToName = new Map<string, string>()
    const nameToId = new Map<string, string>()
    try {
      const response = await fetchApi<MetadataResponse>('/metadata')
      // 处理特殊标签
      if (response.tags?.special) {
        for (const tag of response.tags.special) {
          idToName.set(tag.id, tag.name)
          nameToId.set(tag.name, tag.id)
        }
      }
      // 处理分类标签
      if (response.tags) {
        for (const category of Object.values(response.tags)) {
          if (Array.isArray(category)) {
            for (const tag of category) {
              idToName.set(tag.id, tag.name)
              nameToId.set(tag.name, tag.id)
            }
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch tag mapping:', e)
    }
    tagIdToNameCache = idToName
    tagNameToIdCache = nameToId
  })()

  return tagCachePromise
}

async function getTagIdToNameMap(): Promise<Map<string, string>> {
  await loadTagMappings()
  return tagIdToNameCache!
}

function resolveTagNames(tagIds: string[]): string[] {
  if (!tagIdToNameCache) return tagIds
  return tagIds.map(id => tagIdToNameCache.get(id) || id)
}

// 将 tag 名称转换为 ID（如果传入的是名称而非 ID）
function resolveTagIds(tagNamesOrIds: string[]): string[] {
  if (!tagNameToIdCache) return tagNamesOrIds
  return tagNamesOrIds.map(nameOrId => tagNameToIdCache.get(nameOrId) || nameOrId)
}

// 默认导出
export const api = {
  article: articleApi,
  search: searchApi,
  health: healthApi,
  ai: aiApi,
  getCategories: categoriesApi.getCategories,
  getArticles: async (params: { source?: string; page?: number; page_size?: number }) => {
    // 预加载标签映射
    await getTagIdToNameMap()
    const response = await articleApi.list({ page: params.page, page_size: params.page_size, source: params.source ? decodeURIComponent(params.source) : undefined })
    const transformedItems = response.items.map(item => ({
      id: item.id,
      title: item.title,
      summary: item.summary || item.content?.slice(0, 200) || "",
      published_at: item.published_date,
      source: item.source,
      tags: resolveTagNames(item.tags || []),
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
    // 预加载标签映射
    await loadTagMappings()
    // 将 tag 名称转换为 ID
    const resolvedTags = params.tags ? resolveTagIds(params.tags.split(',').map(t => t.trim()).filter(Boolean)) : undefined
    const resolvedParams = { ...params, tags: resolvedTags ? resolvedTags.join(',') : undefined }
    const queryParams = buildSearchQueryParams(resolvedParams)
    const response = await searchApi.search(queryParams)
    const stripHtml = (html: string) => html ? html.replace(/<[^>]*>/g, '').slice(0, 200) : ''
    const data = response.results.map(r => ({
      id: r.id,
      title: r.title,
      summary: stripHtml(r.summary || ''),
      published_at: r.published_date,
      source: r.source,
      tags: resolveTagNames(r.tags || []),
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
    // 预加载标签映射
    await getTagIdToNameMap()
    const response = await articleApi.get(id)
    return {
      data: {
        id: response.id,
        title: response.title,
        content_md: response.content || "",
        summary: response.summary || "",
        published_at: response.published_date,
        source: response.source,
        source_url: response.url,
        tags: resolveTagNames(response.tags || []),
        url: response.url,
        attachments: (response as any).attachments || [],
      },
    }
  },
  chatWithAI: aiApi.chatWithAI,
  generateTitle: async (content: string) => {
    const response = await fetchWithFallback('/chat/title', {
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
  getMetadata: async (): Promise<MetadataResponse> => {
    return fetchApi<MetadataResponse>('/metadata')
  },
}
