"use client"

import { useState, useEffect } from "react"
import { Loader2, AlertCircle, Trash2, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getFavorites, removeFavorite } from "@/lib/favorites"
import type { FavoriteArticle } from "@/lib/favorites"
import { useRouter } from "next/navigation"

export default function FavoritesPage() {
  const router = useRouter()
  const [favorites, setFavorites] = useState<FavoriteArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      setLoading(true)
      setError(null)
      const storedFavorites = getFavorites()
      setFavorites(storedFavorites)
    } catch (err) {
      console.error('加载收藏失败:', err)
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleRemoveFavorite = (articleId: string) => {
    removeFavorite(articleId)
    setFavorites(prev => prev.filter(fav => fav.id !== articleId))
  }

  const handleArticleClick = (articleId: string) => {
    router.push(`/article/${articleId}`)
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
      </div>
    )
  }
  return (
    <div className="p-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push('/')}
        className="mb-6 gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        返回首页
      </Button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">我的收藏</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {favorites.length > 0 ? `共 ${favorites.length} 篇收藏` : '暂无收藏'}
        </p>
      </div>

      {favorites.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-lg text-muted-foreground">还没有收藏任何文章</p>
          <p className="mt-2 text-sm text-muted-foreground">
            点击文章卡片上的收藏按钮来收藏喜欢的文章
          </p>
        </div>
      )}

      {favorites.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {favorites.map((article) => (
            <div
              key={article.id}
              className="relative cursor-pointer group"
              onClick={() => handleArticleClick(article.id)}
            >
              <div className="rounded-lg border-2 border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-md">
                <h3 className="mb-2 text-base font-semibold text-foreground line-clamp-2">
                  {article.title}
                </h3>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  {article.source && (
                    <span className="rounded bg-secondary px-2 py-0.5">
                      {article.source}
                    </span>
                  )}
                  {article.published_at && (
                    <span>
                      {new Date(article.published_at).toLocaleDateString('zh-CN')}
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemoveFavorite(article.id)
                }}
                className="absolute top-2 right-2 h-8 w-8 rounded-full bg-destructive/10 hover:bg-destructive/20 text-destructive opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}