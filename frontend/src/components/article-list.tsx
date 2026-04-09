"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { ArticleCard } from "@/components/article-card"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { Loader2 } from "lucide-react"

interface ArticleItem {
  id: string
  title: string
  summary: string
  published_at?: string
  source?: string
  tags: string[]
  url: string
}

export function ArticleList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [articles, setArticles] = useState<ArticleItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [total, setTotal] = useState(0)

  const query = searchParams.get("q") || ""
  const currentPage = Number(searchParams.get("page")) || 1
  const source = searchParams.get("source") || ""

  useEffect(() => {
    const fetchArticles = async () => {
      setIsLoading(true)
      try {
        const response = await api.searchArticles({
          q: query,
          page: 1,
          page_size: currentPage * 10,
          source: source
        })
        
        setArticles(response.data || [])
        setTotal(response.pagination?.total || 0)
      } catch (error) {
        console.error("加载文章失败:", error)
        setArticles([])
        setTotal(0)
      } finally {
        setIsLoading(false)
      }
    }

    fetchArticles()
  }, [query, currentPage, source])

  const handleLoadMore = () => {
    const nextPage = currentPage + 1
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", String(nextPage))
    router.push(`?${params.toString()}`, { scroll: false })
  }

  return (
    <main className="flex-1 p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">最新动态</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          浏览校园最新通知、资源和经验分享
        </p>
      </div>

      {isLoading && articles.length === 0 ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : articles.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          暂无文章
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {articles.map((article) => (
            <ArticleCard key={article.id} {...article} />
          ))}
        </div>
      )}

      {!isLoading && articles.length < total && (
        <div className="mt-8 flex justify-center">
          <Button variant="outline" onClick={handleLoadMore} className="w-full max-w-xs">
            加载更多
          </Button>
        </div>
      )}
    </main>
  )
}
