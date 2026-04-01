"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Loader2, AlertCircle, ArrowLeft, ExternalLink, Calendar, Tag, Star, Copy, Share2, Check, X, Download, FileText, QrCode, Maximize2, Minimize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api"
import { isFavorite, toggleFavorite } from "@/lib/favorites"
import type { ArticleDetail, Resource, Attachment } from "@/lib/types"
import { extractPdfUrls } from "@/components/pdf-viewer"
import { QRCodeSVG } from "qrcode.react"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { useReadingMode } from "@/components/reading-mode-provider"

export default function ArticleDetailPage() {
  const params = useParams()
  const router = useRouter()
  const articleId = params.id as string
  const { isReadingMode, toggleReadingMode } = useReadingMode()

  const [article, setArticle] = useState<ArticleDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFav, setIsFav] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showQrCode, setShowQrCode] = useState(false)
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

  const handleShare = async () => {
    const shareData = {
      title: article?.title || '',
      text: article?.summary || '',
      url: window.location.href
    }

    try {
      if (navigator.share) {
        await navigator.share(shareData)
      } else {
        await navigator.clipboard.writeText(window.location.href)
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('分享失败:', err)
      }
    }
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
                onClick={handleShare}
                className="shrink-0"
              >
                <Share2 className="h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowQrCode(true)}
                className="shrink-0"
              >
                <QrCode className="h-5 w-5" />
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
                variant={isReadingMode ? "default" : "outline"}
                size="icon"
                onClick={toggleReadingMode}
                className="shrink-0"
              >
                {isReadingMode ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
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
                    return <img src={imageSrc} alt={typeof alt === 'string' ? alt : ""} className="max-w-full h-auto" />
                  },
                  a: ({ href, children }) => {
                    // href可能是string或Blob
                    const hrefStr = typeof href === 'string' ? href : ''
                    // 检测PDF链接
                    if (hrefStr && hrefStr.toLowerCase().endsWith('.pdf')) {
                      // 使用 [] 中的内容作为 PDF 名称
                      const pdfName = Array.isArray(children)
                        ? children.filter(c => typeof c === 'string').join('')
                        : (typeof children === 'string' ? children : "PDF文档")
                      const fullUrl = hrefStr.startsWith("http") ? hrefStr
                        : hrefStr.startsWith("/_upload/")
                          ? `https://jwc.seu.edu.cn${hrefStr}`
                          : hrefStr
                      return (
                        <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                          <FileText className="h-4 w-4" />
                          {pdfName}
                          <span className="text-xs opacity-70">(PDF)</span>
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
                {article.content_md}
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
          <div className="mt-8">
            <h2 className="mb-4 text-xl font-semibold text-foreground">
              文档附件
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {pdfUrls.map((pdf, index) => (
                <a key={index} href={pdf.url} target="_blank" rel="noopener noreferrer" className="block">
                  <Card className="group cursor-pointer transition-all hover:shadow-md">
                    <CardContent className="flex items-center gap-3 p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
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

        {article.attachments && article.attachments.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-4 text-xl font-semibold text-foreground">
              附件
            </h2>
            {/* 如果文章没有正文内容（PDF-only），显示"查看原文"按钮 */}
            {!article.content_md && !article.content ? (
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
              /* 文章有正文内容，显示附件卡片 */
              <div className="grid gap-3 md:grid-cols-2">
                {article.attachments.map((attachment, index) => {
                  // attachment可能是Attachment对象或字符串URL
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
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
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
      </article>

      {showQrCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-lg">二维码</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowQrCode(false)}
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