"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Loader2, AlertCircle, ArrowLeft, ExternalLink, Calendar, Tag, Star, Copy, Check, X, Download, FileText, FileSpreadsheet, FileArchive, Maximize2, Minimize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api"
import { isFavorite, toggleFavorite } from "@/lib/favorites"
import type { ArticleDetail, Resource, Attachment } from "@/lib/types"
import { extractPdfUrls } from "@/components/pdf-viewer"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { useReadingMode } from "@/components/reading-mode-provider"

export default function ArticleDetailPage() {
  const params = useParams()
  const router = useRouter()
  const articleId = params.id as string
  const { isReadingMode, toggleReadingMode, setIsReadingMode } = useReadingMode()

  const [article, setArticle] = useState<ArticleDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFav, setIsFav] = useState(false)
  const [copied, setCopied] = useState(false)
  const [pdfUrls, setPdfUrls] = useState<Array<{ url: string; name: string }>>([])

  useEffect(() => {
    async function loadArticle() {
      try {
        setLoading(true)
        setError(null)
        const response = await api.getArticleDetail(articleId)
        setArticle(response.data)
        setIsFav(isFavorite(articleId))
        // 从content_md中提取PDF链接
        if (response.data.content_md) {
          const pdfs = extractPdfUrls(response.data.content_md)
          setPdfUrls(pdfs)
        }
      } catch (err) {
        console.error('加载文章失败:', err)
        setError(err instanceof Error ? err.message : '加载失败')
      } finally {
        setLoading(false)
      }
    }

    loadArticle()
  }, [articleId])

  useEffect(() => {
    return () => {
      setIsReadingMode(false)
    }
  }, [setIsReadingMode])

  const handleToggleFavorite = () => {
    if (!article) return
    toggleFavorite({
      id: article.id.toString(),
      title: article.title,
      url: article.url || article.source_url || "",
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
                title="收藏"
              >
                <Star className={`h-5 w-5 ${isFav ? 'fill-current' : ''}`} />
              </Button>
              <Button
                variant={isReadingMode ? "default" : "outline"}
                size="icon"
                onClick={toggleReadingMode}
                className="shrink-0"
                title={isReadingMode ? "退出全屏" : "全屏模式"}
              >
                {isReadingMode ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyLink}
                className="shrink-0"
                title="复制网址"
              >
                {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
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
            {article.content_md ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                  img: ({ src, alt }) => {
                    const imageSrc = typeof src === 'string' ? src : ""
                    return <img src={imageSrc} alt={typeof alt === 'string' ? alt : ""} className="max-w-full h-auto !inline" />
                  },
                  a: ({ href, children }) => {
                    // href可能是string或Blob
                    const hrefStr = typeof href === 'string' ? href : ''
                    // 文件类型配置
                    const fileTypes: Record<string, { extensions: string[], icon: typeof FileText, label: string }> = {
                      pdf: { extensions: ['.pdf'], icon: FileText, label: 'PDF' },
                      excel: { extensions: ['.xls', '.xlsx'], icon: FileSpreadsheet, label: 'Excel' },
                      word: { extensions: ['.doc', '.docx'], icon: FileText, label: 'Word' },
                      archive: { extensions: ['.rar', '.zip', '.7z'], icon: FileArchive, label: '压缩包' },
                    }
                    // 检测文件类型
                    let fileType: string | null = null
                    for (const [key, config] of Object.entries(fileTypes)) {
                      if (config.extensions.some(ext => hrefStr.toLowerCase().endsWith(ext))) {
                        fileType = key
                        break
                      }
                    }
                    if (hrefStr && fileType) {
                      const config = fileTypes[fileType]
                      const Icon = config.icon
                      // 使用 [] 中的内容作为名称
                      const fileName = Array.isArray(children)
                        ? children.filter(c => typeof c === 'string').join('')
                        : (typeof children === 'string' ? children : config.label)
                      const fullUrl = hrefStr.startsWith("http") ? hrefStr
                        : hrefStr.startsWith("/_upload/")
                          ? `https://jwc.seu.edu.cn${hrefStr}`
                          : hrefStr
                      return (
                        <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1 rounded bg-muted text-muted-foreground hover:bg-muted/80 dark:hover:bg-muted/60 cursor-pointer text-sm">
                          <Icon className="h-4 w-4" />
                          {fileName}
                        </a>
                      )
                    }
                    // 普通链接
                    return (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {children}
                      </a>
                    )
                  }
                }}
              >
                {article.content_md.replace(
                  /(https?:\/\/[^\s\u4e00-\u9fa5，。？！；：]+)(?=[\u4e00-\u9fa5，。？！；：])/g,
                  '$1 '
                )}
              </ReactMarkdown>
            ) : article.content ? (
              <p className="whitespace-pre-wrap">{article.content}</p>
            ) : null}
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

        {/* 从内容中提取的PDF附件 */}
        {pdfUrls.length > 0 && (
          <div className="mt-4">
            <h2 className="mb-4 text-xl font-semibold text-foreground">
              文档附件
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {pdfUrls.map((pdf, index) => (
                <a key={index} href={pdf.url} target="_blank" rel="noopener noreferrer" className="block">
                  <Card className="group cursor-pointer transition-all hover:shadow-md">
                    <CardContent className="flex items-center gap-3 p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {pdf.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          PDF文档
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* 
        * attachments 字段降级为非主路径
        * 当前附件主要通过文章的 content_md（Markdown）中的链接来解析和展示
        * 此渲染逻辑暂时注释，保留代码结构以便后续恢复
        *
        {article.attachments && article.attachments.length > 0 && (
          <div className="mt-4">
            <h2 className="mb-4 text-xl font-semibold text-foreground">
              附件
            </h2>
            { !article.content_md && !article.content ? (
              <Card className="bg-muted/50">
                <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                  <FileText className="mb-3 h-12 w-12 text-muted-foreground" />
                  <p className="mb-4 text-sm text-muted-foreground">
                    本文为 PDF 格式，请在原网站查看
                  </p>
                  {article.source_url && (
                    <Button asChild className="gap-2">
                      <a
                        href={article.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                        查看原文
                      </a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {article.attachments.map((attachment, index) => {
                  const url = typeof attachment === 'string' ? attachment : attachment.url
                  const name = typeof attachment === 'string'
                    ? decodeURIComponent(url.split("/").pop()?.replace(/\.pdf$/i, "") || "附件")
                    : (attachment.name || "附件")
                  const fullUrl = url.startsWith("http") ? url
                    : url.startsWith("/_upload/")
                      ? `https://jwc.seu.edu.cn${url}`
                      : url
                  return (
                    <a key={index} href={fullUrl} target="_blank" rel="noopener noreferrer" className="block">
                      <Card className="group cursor-pointer transition-all hover:shadow-md">
                        <CardContent className="flex items-center gap-3 p-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              PDF文档
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </a>
                  )
                })}
              </div>
            )}
          </div>
        )}
        */}
      </article>
    </div>
  )
}

function AttachmentCard({ attachment }: { attachment: Attachment }) {
  return (
    <Card className="group cursor-pointer transition-all hover:shadow-md">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-xl">
          <FileText className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {attachment.name}
          </p>
          {attachment.type && (
            <p className="text-xs text-muted-foreground">
              {attachment.type.toUpperCase()}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="shrink-0"
        >
          <a
            href={attachment.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Download className="h-4 w-4" />
          </a>
        </Button>
      </CardContent>
    </Card>
  )
}