"use client"

import { DatePicker } from "@/components/date-picker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useIsMobile } from "@/hooks/use-mobile"
import { api, MetadataResponse } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Bot, Loader2, Newspaper, Search, Settings, Sparkles, Star, X } from "lucide-react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useRef, useState } from "react"

interface HeaderProps {
  onAIToggle: () => void
}

interface HeaderSearchContentProps {
  onSearchExpand: (expanded: boolean) => void
}

function HeaderSearchContent({ onSearchExpand }: HeaderSearchContentProps) {
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchExpanded, setIsSearchExpanded] = useState(false)
  const [metadata, setMetadata] = useState<MetadataResponse | null>(null)
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const router = useRouter()
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const filterPanelRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()

  useEffect(() => {
    onSearchExpand(isSearchExpanded)
  }, [isSearchExpanded, onSearchExpand])

  useEffect(() => {
    const tagsParam = searchParams.get('tags')
    if (tagsParam) {
      setSelectedTags(tagsParam.split(',').filter(Boolean))
    } else {
      setSelectedTags([])
    }
  }, [searchParams])

  useEffect(() => {
    if (isSearchExpanded && !metadata && !isLoadingMetadata) {
      setIsLoadingMetadata(true)
      api.getMetadata()
        .then(setMetadata)
        .catch(console.error)
        .finally(() => setIsLoadingMetadata(false))
    }
  }, [isSearchExpanded, metadata, isLoadingMetadata])

  const updateSearchParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())

    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    }

    router.push(`/search?${params.toString()}`)
  }

  const handleSourceChange = (source: string) => {
    updateSearchParams({ source: source === 'all' ? null : source })
  }

  const handleTagToggle = (tagName: string) => {
    const newSelectedTags = selectedTags.includes(tagName)
      ? selectedTags.filter(t => t !== tagName)
      : [...selectedTags, tagName]

    setSelectedTags(newSelectedTags)
    updateSearchParams({ tags: newSelectedTags.length > 0 ? newSelectedTags.join(',') : null })
  }

  const handleTimeRangeChange = (range: string) => {
    updateSearchParams({
      time: range || null,
      date: null
    })
  }

  const handleDateChange = (date: string) => {
    updateSearchParams({
      date: date || null,
      time: null
    })
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && filterPanelRef.current) {
        const isClickInsideSearch = searchContainerRef.current.contains(event.target as Node)
        const isClickInsideFilter = filterPanelRef.current.contains(event.target as Node)

        if (!isClickInsideSearch && !isClickInsideFilter) {
          setIsSearchExpanded(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const trimmedQuery = searchQuery.trim()
      if (trimmedQuery) {
        const params = new URLSearchParams(searchParams.toString())
        params.set('q', trimmedQuery)
        router.push(`/search?${params.toString()}`)
      }
    }
  }

  const currentSource = searchParams.get('source')
  const currentTime = searchParams.get('time')

  const renderFilterPanel = () => (
    <div className="space-y-4">
      {isLoadingMetadata ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : metadata ? (
        <>
          {metadata.tags.special && metadata.tags.special.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <label className="text-xs font-medium text-amber-700 dark:text-amber-300">特殊标签</label>
              </div>
              <div className="flex flex-wrap gap-2">
                {metadata.tags.special.map((tag) => (
                  <Button
                    key={tag.id}
                    variant={selectedTags.includes(tag.name) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleTagToggle(tag.name)}
                    className={cn(
                      "h-7 text-xs transition-all",
                      selectedTags.includes(tag.name)
                        ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-500"
                        : "border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                    )}
                  >
                    {tag.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">来源</label>
            {metadata.sources.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={!currentSource ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleSourceChange('all')}
                  className="h-7 text-xs"
                >
                  全部
                </Button>
                {metadata.sources.map((source) => (
                  <Button
                    key={source}
                    variant={currentSource === source ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleSourceChange(source)}
                    className="h-7 text-xs"
                  >
                    {source}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">暂无可选来源</p>
            )}
          </div>

          {metadata.categories.map((category) => {
            const categoryTags = metadata.tags[category.id] || []
            if (categoryTags.length === 0) return null

            return (
              <div key={category.id}>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  {category.name}
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {categoryTags.map((tag) => (
                    <Button
                      key={tag.id}
                      variant={selectedTags.includes(tag.name) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleTagToggle(tag.name)}
                      className="h-7 text-xs justify-start"
                    >
                      {tag.name}
                    </Button>
                  ))}
                </div>
              </div>
            )
          })}

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">时间范围</label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: '', label: '不限' },
                { value: 'today', label: '今天' },
                { value: '7days', label: '近7天' },
                { value: '30days', label: '近30天' },
                { value: '6months', label: '近半年' },
                { value: '1year', label: '近一年' },
              ].map((item) => (
                <Button
                  key={item.value}
                  variant={currentTime === (item.value || null) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleTimeRangeChange(item.value)}
                  className="h-7 text-xs"
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">日期选择</label>
            <DatePicker
              selectedDate={searchParams.get('date')}
              onSelectDate={handleDateChange}
            />
          </div>
        </>
      ) : (
        <div className="text-center py-4 text-muted-foreground text-sm">
          加载失败，请重试
        </div>
      )}
    </div>
  )

  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="relative w-full max-w-2xl flex items-center gap-2">
        {isMobile ? (
          <div
            ref={searchContainerRef}
            className={`relative flex-1 ${isSearchExpanded ? 'max-w-none' : 'max-w-[300px]'}`}
            onClick={() => !isSearchExpanded && setIsSearchExpanded(true)}
          >
            <div className="relative flex items-center">
              <div
                className={`relative transition-all duration-300 ${isSearchExpanded ? 'w-full' : 'w-9'}`}
              >
                <Search
                  className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10 ${isSearchExpanded ? 'left-3' : 'left-1/2 -translate-x-1/2'}`}
                />
                <Input
                  type="search"
                  placeholder="搜索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearch}
                  onFocus={() => setIsSearchExpanded(true)}
                  className="h-9 w-full rounded-full border-border bg-secondary pl-9 pr-4 text-sm placeholder:text-muted-foreground focus-visible:ring-primary"
                />
                {isSearchExpanded && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsSearchExpanded(false)
                      setSearchQuery('')
                    }}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div ref={searchContainerRef} className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
            <Input
              type="search"
              placeholder="搜索文章、通知、资源..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearch}
              onFocus={() => setIsSearchExpanded(true)}
              className="h-9 w-full rounded-full border-border bg-secondary pl-9 pr-4 text-sm placeholder:text-muted-foreground focus-visible:ring-primary"
            />
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full shrink-0"
          onClick={() => router.push('/search?time=today')}
          title="查看今日文章"
        >
          <Newspaper className="h-4 w-4" />
          <span className="sr-only">今日文章</span>
        </Button>

        {isSearchExpanded && (
          <div
            ref={filterPanelRef}
            className={`${isMobile ? 'fixed left-4 right-4 top-[56px] mt-0' : 'absolute left-1/2 -translate-x-1/2 top-full mt-2 w-[600px]'} rounded-xl border border-border bg-background p-4 shadow-lg z-[55] max-h-[70vh] overflow-y-auto`}
          >
            {renderFilterPanel()}
          </div>
        )}
      </div>
    </div>
  )
}

function HeaderSearchFallback() {
  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="h-9 w-full rounded-full border-border bg-secondary px-4" />
      </div>
    </div>
  )
}

export function Header({ onAIToggle }: HeaderProps) {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false)
  const [logoError, setLogoError] = useState(false)
  const [isZoomed, setIsZoomed] = useState(false)
  const isMobile = useIsMobile()
  const router = useRouter()

  const handleSettingsClick = () => {
    router.push('/settings')
  }

  const handleFavoritesClick = () => {
    router.push('/favorites')
  }

  return (
    <>
      <header className="sticky top-0 z-[50] flex h-14 items-center justify-between border-b border-border bg-card/95 px-4 shadow-sm backdrop-blur-sm">
        <div className={`flex items-center gap-2 ${isMobile && isSearchExpanded ? 'hidden' : ''}`}>
          <div
            className="relative flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-lg transition-transform hover:scale-110 active:scale-95"
            onClick={() => setIsZoomed(true)}
          >
            {logoError ? (
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
                W
              </span>
            ) : (
              <Image
                src="/images/logo.jpg"
                alt="WuHub Logo"
                width={40}
                height={40}
                className="h-full w-full object-cover"
                onError={() => setLogoError(true)}
              />
            )}
          </div>

          <span
            className="text-lg font-semibold text-foreground cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => router.push('/')}
          >
            SEU-WuHub
          </span>
        </div>

        <Suspense fallback={<HeaderSearchFallback />}>
          <HeaderSearchContent onSearchExpand={setIsSearchExpanded} />
        </Suspense>

        {!isMobile && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={handleFavoritesClick}
              title="收藏夹"
            >
              <Star className="h-5 w-5" />
              <span className="sr-only">收藏夹</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={onAIToggle}
              title="SEU Agent"
            >
              <Bot className="h-5 w-5" />
              <span className="sr-only">AI 助手</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={handleSettingsClick}
              title="设置"
            >
              <Settings className="h-5 w-5" />
              <span className="sr-only">设置</span>
            </Button>
          </div>
        )}
      </header>

      {isZoomed && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
          onClick={() => setIsZoomed(false)}
        >
          <div
            className="relative flex flex-col items-center gap-6 animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-72 w-72 overflow-hidden rounded-2xl border-4 border-white/20 shadow-2xl md:h-96 md:w-96">
              <Image
                src="/images/logo.jpg"
                alt="Expanded Logo"
                width={400}
                height={400}
                className="h-full w-full object-cover"
              />
            </div>
            <Button
              variant="outline"
              className="bg-white/10 text-white border-white/20 hover:bg-white/20 backdrop-blur-md"
              onClick={() => setIsZoomed(false)}
            >
              点击此处或背景收起
            </Button>
          </div>
        </div>
      )}
    </>
  )
}