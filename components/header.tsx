"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Bot, Star, Settings } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import Image from "next/image"

interface HeaderProps {
  onAIToggle: () => void
}

export function Header({ onAIToggle }: HeaderProps) {
  const [logoError, setLogoError] = useState(false)
  const router = useRouter()

  const handleSettingsClick = () => {
    router.push('/settings')
  }

  const handleFavoritesClick = () => {
    router.push('/favorites')
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-card/95 px-4 shadow-sm backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <div
          className="relative flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-lg"
          onClick={() => router.push('/')}
        >
          {logoError ? (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-base font-bold text-primary-foreground">
              W
            </span>
          ) : (
            <Image
              src="/logo.png"
              alt="WuHub Logo"
              fill
              className="object-cover"
              onError={() => setLogoError(true)}
            />
          )}
        </div>

        <span className="text-lg font-semibold text-foreground">SEU-WuHub</span>
      </div>

      <div className="flex flex-1 items-center justify-center px-4">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="搜索文章、通知、资源..."
            className="h-9 w-full rounded-full border-border bg-secondary pl-9 pr-4 text-sm placeholder:text-muted-foreground focus-visible:ring-primary"
          />
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={handleFavoritesClick}
        >
          <Star className="h-5 w-5" />
          <span className="sr-only">收藏夹</span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={onAIToggle}
        >
          <Bot className="h-5 w-5" />
          <span className="sr-only">AI 助手</span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={handleSettingsClick}
        >
          <Settings className="h-5 w-5" />
          <span className="sr-only">设置</span>
        </Button>
      </div>
    </header>
  )
}