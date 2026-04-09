export interface Article {
  id: string
  title: string
  url: string
  content?: string
  summary?: string
  author?: string
  published_at?: string
  tags: string[]
  source?: string
}

export interface Resource {
  name: string
  url: string
  type?: string
  size?: string
}

export interface Attachment {
  name: string
  url: string
  type?: string
}

export interface ArticleDetail {
  id: string
  title: string
  content?: string
  content_md?: string
  summary?: string
  author?: string
  published_at?: string
  updated_at?: string
  tags: string[]
  source?: string
  source_url?: string
  url?: string
  attachments?: Attachment[]
}

export interface Category {
  id: string
  name: string
  icon?: string
  children?: Category[]
}
