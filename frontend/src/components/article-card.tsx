"use client"

import { useState } from "react"
import { Clock, Tag, Star } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { isFavorite, toggleFavorite } from "@/lib/favorites"
import type { FavoriteArticle } from "@/lib/favorites"

interface ArticleCardProps {
  id: string | number
  title: string
  summary: string
  time: string
  source: string
  tags: string[]
}

export function ArticleCard({ id, title, summary, time, source, tags }: ArticleCardProps) {
  const [favorited, setFavorited] = useState(() => isFavorite(String(id)))
  return (
    <Card className="group cursor-pointer border-border bg-card transition-all hover:border-primary/30 hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="flex-1 line-clamp-2 text-base font-semibold text-card-foreground group-hover:text-primary">
            {title}
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={(e) => {
              e.stopPropagation()
              const article: FavoriteArticle = {
                id: String(id),
                title,
                url: "",
                source,
                published_at: time,
                added_at: new Date().toISOString(),
              }
              toggleFavorite(article)
              setFavorited(isFavorite(String(id)))
            }}
          >
            <Star className={`h-4 w-4 ${favorited ? 'fill-current text-yellow-500' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="line-clamp-2 text-sm text-muted-foreground">{summary}</p>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="rounded-full text-xs">
              <Tag className="mr-1 h-3 w-3" />
              {tag}
            </Badge>
          ))}
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {time}
          </span>
          <span className="rounded bg-secondary px-2 py-0.5">{source}</span>
        </div>
      </CardContent>
    </Card>
  )
}
