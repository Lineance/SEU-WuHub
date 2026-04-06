"use client"

import { Suspense, useState, useRef, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, Bot, Star, Settings, Loader2, Newspaper, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/date-picker"
import Image from "next/image"
import { useIsMobile } from "@/hooks/use-mobile"

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
  const router = useRouter()
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const filterPanelRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()

  // 当搜索展开状态变化时，通知父组件
  useEffect(() => {
    onSearchExpand(isSearchExpanded)
  }, [isSearchExpanded, onSearchExpand])

  const updateSearchParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())

    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }

    router.push(`/search?${params.toString()}`)
  }

  const handleSourceChange = (source: string) => {
    updateSearchParam('source', source === 'all' ? null : source)
  }

  const handleTagChange = (tag: string) => {
    updateSearchParam('tag', tag === 'all' ? null : tag)
  }

  const handleTimeRangeChange = (range: string) => {
    const params = new URLSearchParams(searchParams.toString())

    if (range) {
      params.set('time', range)
      params.delete('date')
    } else {
      params.delete('time')
      params.delete('date')
    }

    router.push(`/search?${params.toString()}`)
  }

  const handleDateChange = (date: string) => {
    const params = new URLSearchParams(searchParams.toString())

    if (date) {
      params.set('date', date)
      params.delete('time')
    } else {
      params.delete('date')
      params.delete('time')
    }

    router.push(`/search?${params.toString()}`)
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

  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="relative w-full max-w-md flex items-center gap-2">
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
            className={`${isMobile ? 'fixed left-4 right-4 top-[56px] mt-0' : 'absolute left-0 right-0 top-full mt-2'} rounded-xl border border-border bg-background p-4 shadow-lg z-[55]`}
          >
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">来源</label>
                <div className="flex flex-wrap gap-2">
                  {['all', 'news', 'notice', 'resource'].map((source) => (
                    <Button
                      key={source}
                      variant={searchParams.get('source') === (source === 'all' ? null : source) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleSourceChange(source)}
                      className="h-7 text-xs"
                    >
                      {source === 'all' ? '全部' : source === 'news' ? '新闻' : source === 'notice' ? '通知' : '资源'}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">标签</label>
                <div className="flex flex-wrap gap-2">
                  {['all', 'academic', 'activity', 'job', 'other'].map((tag) => (
                    <Button
                      key={tag}
                      variant={searchParams.get('tag') === (tag === 'all' ? null : tag) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleTagChange(tag)}
                      className="h-7 text-xs"
                    >
                      {tag === 'all' ? '全部' : tag === 'academic' ? '学术' : tag === 'activity' ? '活动' : tag === 'job' ? '招聘' : '其他'}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">时间范围</label>
                <div className="flex flex-wrap gap-2">
                  {['', 'today', '7days', '30days', '6months', '1year'].map((range) => (
                    <Button
                      key={range}
                      variant={searchParams.get('time') === (range === '' ? null : range) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleTimeRangeChange(range)}
                      className="h-7 text-xs"
                    >
                      {range === '' ? '不限' : range === 'today' ? '今天' : range === '7days' ? '近7天' : range === '30days' ? '近30天' : range === '6months' ? '近半年' : '近一年'}
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
            </div>
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
                fill
                className="object-cover"
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