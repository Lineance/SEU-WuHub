"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Loader2, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react"
import { ArticleCard } from "@/components/article-card"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import type { Article } from "@/lib/types"

export default function CategoryPage() {
  const params = useParams()
  const router = useRouter()
  const categoryId = params.id as string

  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)

  const loadArticles = async (pageNum: number) => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.getArticles({
        category_id: categoryId,
        page: pageNum,
        page_size: 20,
      })
      setArticles(response.data)
      setTotalPages(response.pagination.total_pages)
      setTotal(response.pagination.total)
      setPage(response.pagination.page)
    } catch (err) {
      console.error('加载文章失败:', err)
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadArticles(1)
  }, [categoryId])

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      loadArticles(newPage)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          分类: {decodeURIComponent(categoryId)}
        </h1>
        {!loading && !error && (
          <p className="mt-1 text-sm text-muted-foreground">
            共 {total} 篇文章
          </p>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="mb-3 h-12 w-12 text-destructive" />
          <p className="text-lg text-muted-foreground">{error}</p>
          <Button
            variant="outline"
            onClick={() => loadArticles(page)}
            className="mt-4"
          >
            重试
          </Button>
        </div>
      )}

      {!loading && !error && articles.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-lg text-muted-foreground">暂无文章</p>
        </div>
      )}

      {!loading && !error && articles.length > 0 && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            {articles.map((article) => (
              <div
                key={article.id}
                onClick={() => router.push(`/article/${article.id}`)}
                className="cursor-pointer"
              >
                <ArticleCard
                  id={article.id}
                  title={article.title}
                  summary={article.summary}
                  time={article.published_at}
                  source={article.source}
                  tags={article.tags}
                />
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
                上一页
              </Button>
              <span className="text-sm text-muted-foreground">
                第 {page} / {totalPages} 页
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
              >
                下一页
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
