"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Search, AlertCircle, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ArticleCard } from "@/components/article-card"
import { api } from "@/lib/api"
import type { Article } from "@/lib/types"

export default function SearchPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const query = searchParams.get('q')
  const pageParam = searchParams.get('page')
  const page = Number(pageParam ?? '1')
  const safePage = isNaN(page) || page < 1 ? 1 : page

  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!query) return

    async function search() {
      try {
        setLoading(true)
        setError(null)
        const response = await api.searchArticles({
          q: query || undefined,
          page: safePage,
          page_size: 20,
        })
        setArticles(response.data)
      } catch (err) {
        console.error('搜索失败:', err)
        setError('搜索失败，请稍后再试')
      } finally {
        setLoading(false)
      }
    }

    search()
  }, [query, safePage])

  if (!query) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="mb-3 h-12 w-12 text-muted-foreground" />
        <p className="text-lg text-muted-foreground">请输入搜索内容</p>
        <Button
          variant="outline"
          onClick={() => window.location.href = '/'}
          className="mt-4"
        >
          返回首页
        </Button>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Search className="h-5 w-5" />
          <span>搜索结果：</span>
          <span className="font-semibold text-foreground">{query}</span>
          {!loading && !error && articles.length > 0 && (
            <span className="ml-2 text-sm">({articles.length} 条)</span>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">搜索中...</p>
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="mb-3 h-12 w-12 text-destructive" />
          <p className="text-lg text-muted-foreground">{error}</p>
        </div>
      )}

      {!loading && !error && articles.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="mb-3 h-12 w-12 text-muted-foreground" />
          <p className="text-lg text-muted-foreground">未找到相关文章</p>
          <p className="mt-2 text-sm text-muted-foreground">
            试试其他关键词
          </p>
        </div>
      )}

      {!loading && !error && articles.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {articles.map((article) => (
            <div
              key={article.id}
              className="cursor-pointer"
              onClick={() => router.push(`/article/${article.id}`)}
            >
              <ArticleCard
                id={article.id}
                title={article.title}
                summary={article.summary}
                time={new Date(article.published_at).toLocaleDateString('zh-CN')}
                source={article.source}
                tags={article.tags}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}