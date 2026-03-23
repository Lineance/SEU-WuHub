"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Loader2, AlertCircle, ArrowLeft, ExternalLink, Calendar, Tag, Star, Copy, Share2, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api"
import { isFavorite, toggleFavorite } from "@/lib/favorites"
import type { ArticleDetail, Resource } from "@/lib/types"
import { QRCodeSVG } from "qrcode.react"

export default function ArticleDetailPage() {
  const params = useParams()
  const router = useRouter()
  const articleId = params.id as string

  const [article, setArticle] = useState<ArticleDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFav, setIsFav] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)

  useEffect(() => {
    async function loadArticle() {
      try {
        setLoading(true)
        setError(null)
        const response = await api.getArticleDetail(articleId)
        setArticle(response.data)
        setIsFav(isFavorite(articleId))
      } catch (err) {
        console.error('加载文章失败:', err)
        setError(err instanceof Error ? err.message : '加载失败')
      } finally {
        setLoading(false)
      }
    }

    loadArticle()
  }, [articleId])

  const handleToggleFavorite = () => {
    if (!article) return
    toggleFavorite({
      id: article.id.toString(),
      title: article.title,
      source: article.source,
      published_at: article.published_at
    })
    setIsFav(prev => !prev)
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('复制失败:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="mb-3 h-12 w-12 text-destructive" />
        <p className="text-lg text-muted-foreground">{error}</p>
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="mt-4"
        >
          返回
        </Button>
      </div>
    )
  }

  if (!article) {
    return null
  }

  return (
    <div className="p-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.back()}
        className="mb-6 gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        返回
      </Button>

      <article className="mx-auto max-w-4xl">
        <header className="mb-8">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h1 className="flex-1 text-3xl font-bold text-foreground">
              {article.title}
            </h1>
            <div className="flex gap-2">
              <Button
                variant={isFav ? "default" : "outline"}
                size="icon"
                onClick={handleToggleFavorite}
                className="shrink-0"
              >
                <Star className={`h-5 w-5 ${isFav ? 'fill-current' : ''}`} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyLink}
                className="shrink-0"
              >
                {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowShareModal(true)}
                className="shrink-0"
              >
                <Share2 className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <time dateTime={article.published_at}>
                {new Date(article.published_at).toLocaleDateString('zh-CN')}
              </time>
            </div>
            <div className="rounded bg-secondary px-2 py-1">
              {article.source}
            </div>
            {article.updated_at && article.updated_at !== article.published_at && (
              <span>
                更新于 {new Date(article.updated_at).toLocaleDateString('zh-CN')}
              </span>
            )}
          </div>

          {article.tags && article.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {article.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  <Tag className="h-3 w-3" />
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </header>

        <Card>
          <CardContent className="prose prose-slate dark:prose-invert max-w-none">
            <div
              dangerouslySetInnerHTML={{ __html: article.content }}
              className="article-content"
            />
          </CardContent>
        </Card>

        {article.source_url && (
          <div className="mt-6">
            <Button
              variant="outline"
              asChild
              className="gap-2"
            >
              <a
                href={article.source_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4" />
                查看原文
              </a>
            </Button>
          </div>
        )}

        {article.resources && article.resources.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-4 text-xl font-semibold text-foreground">
              附件资源
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {article.resources.map((resource) => (
                <ResourceCard key={resource.id} resource={resource} />
              ))}
            </div>
          </div>
        )}
      </article>

      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-lg">分享文章</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowShareModal(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-4">
              <div className="rounded-lg bg-white p-4">
                <QRCodeSVG
                  value={window.location.href}
                  size={200}
                  level="M"
                  includeMargin={false}
                />
              </div>
              <p className="text-center text-sm text-muted-foreground">
                扫描二维码查看文章
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function ResourceCard({ resource }: { resource: Resource }) {
  const getIconByType = (type: string) => {
    switch (type) {
      case 'image':
        return '🖼️'
      case 'document':
        return '📄'
      case 'media':
        return '🎬'
      default:
        return '📎'
    }
  }

  return (
    <Card className="group cursor-pointer transition-all hover:shadow-md">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-secondary text-2xl">
          {getIconByType(resource.type)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {resource.filename || resource.url.split('/').pop()}
          </p>
          {resource.size && (
            <p className="text-xs text-muted-foreground">
              {formatFileSize(resource.size)}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="opacity-0 transition-opacity group-hover:opacity-100"
        >
          <a
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            download
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </CardContent>
    </Card>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}