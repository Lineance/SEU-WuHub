"use client"

import { Suspense, useState, useEffect, useMemo } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Search, AlertCircle, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArticleCard } from "@/components/article-card"
import { DatePicker } from "@/components/date-picker"
import { api } from "@/lib/api"
import type { Article } from "@/lib/types"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

function SearchContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const query = searchParams.get('q') || ""
  const source = searchParams.get('source')
  const tag = searchParams.get('tag')
  const time = searchParams.get('time')
  const date = searchParams.get('date')
  const exactParam = searchParams.get('exact')
  const exactMatch = exactParam === 'true'
  const pageParam = searchParams.get('page')
  const page = Number(pageParam ?? '1')
  const safePage = isNaN(page) || page < 1 ? 1 : page

  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function search() {
      try {
        setLoading(true)
        setError(null)
        const response = await api.searchArticles({
          q: query || undefined,
          source: source || undefined,
          tag: tag || undefined,
          time: time || undefined,
          date: date || undefined,
          exact: exactMatch,
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
  }, [query, source, tag, time, date, exactMatch, safePage])

  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      // 精确匹配：仅当开启时过滤
      if (exactMatch && query && !article.title.includes(query) && !article.summary?.includes(query)) {
        return false
      }

      if (source && article.source !== source) {
        return false
      }

      if (tag && !article.tags?.includes(tag)) {
        return false
      }

      if (time) {
        const now = new Date()
        const articleDate = article.published_at ? new Date(article.published_at) : new Date()
        const diffDays = (now.getTime() - articleDate.getTime()) / (1000 * 60 * 60 * 24)
        const timeRangeMap: Record<string, number> = {
          'today': 1,
          '7days': 7,
          '30days': 30,
          '6months': 180,
          '1year': 365,
        }
        const range = timeRangeMap[time]
        if (range && diffDays > range) {
          return false
        }
      }

      if (date) {
        const articleDateStr = article.published_at ? new Date(article.published_at).toISOString().split('T')[0] : ''
        if (articleDateStr !== date) {
          return false
        }
      }

      return true
    })
  }, [articles, query, source, tag, time, date, exactMatch])

  const sources = Array.from(new Set(articles.map((a) => a.source).filter(Boolean)))
  const tags = Array.from(new Set(articles.flatMap((a) => a.tags || [])))

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Search className="h-5 w-5" />
          <span>搜索结果：</span>
          {query && (
            <span className="font-semibold text-foreground">{query}</span>
          )}
          {!loading && !error && filteredArticles.length > 0 && (
            <span className="ml-2 text-sm">({filteredArticles.length} 条)</span>
          )}
        </div>
      </div>

      <div className="mb-6 space-y-4">
        <div>
          <div className="mb-2 text-sm font-medium text-foreground">来源</div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={source === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString())
                params.delete('source')
                router.push(`/search?${params.toString()}`)
              }}
            >
              全部
            </Button>
            {sources.map((s) => (
              <Button
                key={s}
                variant={source === s ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  const params = new URLSearchParams(searchParams.toString())
                  params.set('source', s)
                  router.push(`/search?${params.toString()}`)
                }}
              >
                {s}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm font-medium text-foreground">标签</div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={tag === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString())
                params.delete('tag')
                router.push(`/search?${params.toString()}`)
              }}
            >
              全部
            </Button>
            {tags.map((t) => (
              <Button
                key={t}
                variant={tag === t ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  const params = new URLSearchParams(searchParams.toString())
                  params.set('tag', t)
                  router.push(`/search?${params.toString()}`)
                }}
              >
                {t}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm font-medium text-foreground">时间</div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={!time && !date ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString())
                params.delete('time')
                params.delete('date')
                router.push(`/search?${params.toString()}`)
              }}
            >
              全部
            </Button>
            <Button
              variant={time === 'today' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString())
                params.set('time', 'today')
                params.delete('date')
                router.push(`/search?${params.toString()}`)
              }}
            >
              今天
            </Button>
            <Button
              variant={time === '7days' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString())
                params.set('time', '7days')
                params.delete('date')
                router.push(`/search?${params.toString()}`)
              }}
            >
              近7天
            </Button>
            <Button
              variant={time === '30days' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString())
                params.set('time', '30days')
                params.delete('date')
                router.push(`/search?${params.toString()}`)
              }}
            >
              近30天
            </Button>
            <Button
              variant={time === '6months' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString())
                params.set('time', '6months')
                params.delete('date')
                router.push(`/search?${params.toString()}`)
              }}
            >
              近半年
            </Button>
            <Button
              variant={time === '1year' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString())
                params.set('time', '1year')
                params.delete('date')
                router.push(`/search?${params.toString()}`)
              }}
            >
              近一年
            </Button>
            <DatePicker
              selectedDate={date}
              onSelectDate={(newDate) => {
                const params = new URLSearchParams(searchParams.toString())
                if (newDate) {
                  params.set('date', newDate)
                  params.delete('time')
                } else {
                  params.delete('date')
                  params.delete('time')
                }
                router.push(`/search?${params.toString()}`)
              }}
            />
          </div>
        </div>

        {/* 精确匹配开关 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id="exact-match"
              checked={exactMatch}
              onCheckedChange={(checked) => {
                const params = new URLSearchParams(searchParams.toString())
                if (checked) {
                  params.set('exact', 'true')
                } else {
                  params.delete('exact')
                }
                router.push(`/search?${params.toString()}`)
              }}
            />
            <Label htmlFor="exact-match" className="text-sm font-medium cursor-pointer">
              精确匹配
            </Label>
          </div>
          <span className="text-xs text-muted-foreground">
            开启后仅显示标题或摘要中包含关键词的结果
          </span>
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

      {!loading && !error && filteredArticles.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="mb-3 h-12 w-12 text-muted-foreground" />
          <p className="text-lg text-muted-foreground">未找到相关文章</p>
          <p className="mt-2 text-sm text-muted-foreground">
            试试其他关键词或调整筛选条件
          </p>
        </div>
      )}

      {!loading && !error && filteredArticles.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredArticles.map((article) => (
            <div
              key={article.id}
              className="cursor-pointer"
              onClick={() => router.push(`/article/${article.id}`)}
            >
              <ArticleCard
                id={article.id}
                title={article.title}
                summary={article.summary}
                time={article.published_at ? new Date(article.published_at).toLocaleDateString('zh-CN') : ''}
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

function SearchLoading() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchLoading />}>
      <SearchContent />
    </Suspense>
  )
}