/**
 * API Types - TypeScript interfaces matching backend data models
 *
 * Responsibilities:
 * - Article interface definition
 * - API response wrapper types
 * - Pagination types
 */

export interface Article {
  id: string
  title: string
  summary: string
  content?: string
  content_text?: string
  source: string
  author?: string
  source_url: string
  published_at: string | null
  updated_at?: string | null
  tags: string[]
  metadata?: string | Record<string, unknown>
}

export interface ArticleDetail extends Article {
  content: string
  content_text: string
}

export interface Resource {
  id: string
  filename: string
  url: string
  size?: number
  type: "image" | "document" | "media" | "other"
}

export interface Category {
  id: string
  name: string
  icon?: string
  children?: Category[]
  count?: number
}

export interface Pagination {
  page: number
  page_size: number
  total: number
  total_pages: number
}

export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
  pagination?: Pagination
  query?: string
}

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
  timestamp: string
}

export interface ChatContext {
  id: string
  title: string
  summary: string
  source: string
  source_url: string
  published_at: string | null
  tags: string[]
}

export interface ChatChunk {
  content: string
}

export type FeedbackType = "bug" | "suggestion" | "other"
