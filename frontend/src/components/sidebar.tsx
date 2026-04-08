"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ChevronRight, BookOpen, Compass, Bell, Link2, FileText, GraduationCap, Lightbulb, Trophy, Home, HelpCircle, Building, Users, Globe, Loader2, AlertCircle, PanelLeftClose, PanelLeftOpen, Bot, Settings, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import type { Category } from "@/lib/types"

const iconMap: Record<string, React.ReactNode> = {
  'book': <BookOpen className="h-4 w-4" />,
  'compass': <Compass className="h-4 w-4" />,
  'bell': <Bell className="h-4 w-4" />,
  'link': <Link2 className="h-4 w-4" />,
  'file-text': <FileText className="h-4 w-4" />,
  'graduation-cap': <GraduationCap className="h-4 w-4" />,
  'lightbulb': <Lightbulb className="h-4 w-4" />,
  'trophy': <Trophy className="h-4 w-4" />,
  'home': <Home className="h-4 w-4" />,
  'help-circle': <HelpCircle className="h-4 w-4" />,
  'building': <Building className="h-4 w-4" />,
  'users': <Users className="h-4 w-4" />,
  'globe': <Globe className="h-4 w-4" />,
}

interface NavItemComponentProps {
  item: Category
  level?: number
  isCollapsed?: boolean
  onActionClick?: () => void
}

function NavItemComponent({ item, level = 0, isCollapsed = false, onActionClick }: NavItemComponentProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(level === 0 && item.children && item.children.length > 0 ? true : false)
  const hasChildren = item.children && item.children.length > 0

  const handleClick = () => {
    if (hasChildren) {
      setIsOpen(!isOpen)
    } else if (item.name) {
      router.push(`/search?source=${encodeURIComponent(item.name)}`)
      onActionClick?.()
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
          level > 0 && "ml-4",
          level > 0
            ? "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
            : "text-foreground hover:bg-sidebar-accent"
        )}
      >
        {hasChildren && (
          <ChevronRight
            className={cn(
              "h-4 w-4 shrink-0 transition-transform",
              isOpen && "rotate-90"
            )}
          />
        )}
        {!hasChildren && <span className="w-4" />}
        {item.icon && iconMap[item.icon] || <FileText className="h-4 w-4" />}
        <span className={cn("truncate", isCollapsed && "hidden")}>{item.name}</span>
      </button>
      {hasChildren && isOpen && (
        <div className="mt-1 space-y-1">
          {item.children!.map((child) => (
            <NavItemComponent
              key={child.id}
              item={child}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface SidebarProps {
  isCollapsed?: boolean
  onToggleCollapse?: () => void
  isMobile?: boolean
  onActionClick?: () => void
  onAgentClick?: () => void
}

export function Sidebar({ isCollapsed = false, onToggleCollapse, isMobile = false, onActionClick, onAgentClick }: SidebarProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    async function loadCategories() {
      try {
        setLoading(true)
        setError(null)
        const response = await api.getCategories()
        setCategories(response.data)
      } catch (err) {
        console.error('加载分类失败:', err)
        setError(err instanceof Error ? err.message : '加载失败')
      } finally {
        setLoading(false)
      }
    }

    loadCategories()
  }, [])

  const handleAgentClick = () => {
    onAgentClick?.()
    onActionClick?.()
  }

  const handleFavoritesClick = () => {
    router.push('/favorites')
    onActionClick?.()
  }

  const handleSettingsClick = () => {
    router.push('/settings')
    onActionClick?.()
  }

  return (
    <aside
      className={cn(
        "shrink-0 border-r border-sidebar-border bg-sidebar p-4 transition-all duration-300",
        isMobile ? "h-full" : "sticky top-14 overflow-y-auto",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {!isMobile && (
        <div className="mb-4 flex items-center justify-between">
          <span className={cn("text-lg font-semibold text-foreground", isCollapsed && "hidden")}>导航</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="shrink-0"
            title={isCollapsed ? "展开侧边栏" : "折叠侧边栏"}
          >
            {isCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </Button>
        </div>
      )}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className={cn("flex flex-col items-center justify-center py-8 text-center", !isCollapsed && "px-2")}>
          <AlertCircle className="mb-2 h-6 w-6 text-destructive" />
          <p className={cn("text-sm text-muted-foreground", !isCollapsed && "truncate")}>{error}</p>
        </div>
      )}

      {!loading && !error && categories.length === 0 && (
        <div className={cn("flex flex-col items-center justify-center py-8 text-center", !isCollapsed && "px-2")}>
          <FileText className="mb-2 h-6 w-6 text-muted-foreground" />
          <p className={cn("text-sm text-muted-foreground", !isCollapsed && "truncate")}>暂无分类</p>
        </div>
      )}

      <div className={cn(
        "space-y-1",
        isMobile && "pb-20"
      )}>
        {!loading && !error && categories.length > 0 && (
          <nav className="space-y-1">
            {categories.map((item) => (
              <NavItemComponent
                key={item.id}
                item={item}
                isCollapsed={isCollapsed}
                onActionClick={onActionClick}
              />
            ))}
          </nav>
        )}
      </div>

      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-sidebar p-4">
          <div className="flex justify-around gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="flex flex-col items-center gap-1"
              onClick={handleAgentClick}
            >
              <Bot className="h-5 w-5" />
              <span className="text-xs">Agent</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="flex flex-col items-center gap-1"
              onClick={handleFavoritesClick}
            >
              <Star className="h-5 w-5" />
              <span className="text-xs">收藏</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="flex flex-col items-center gap-1"
              onClick={handleSettingsClick}
            >
              <Settings className="h-5 w-5" />
              <span className="text-xs">设置</span>
            </Button>
          </div>
        </div>
      )}
    </aside>
  )
}
