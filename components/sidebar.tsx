"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ChevronRight, BookOpen, Compass, Bell, Link2, FileText, GraduationCap, Lightbulb, Trophy, Home, HelpCircle, Building, Users, Globe, Loader2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
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
}

function NavItemComponent({ item, level = 0 }: NavItemComponentProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(level === 0 && item.children && item.children.length > 0 ? true : false)
  const hasChildren = item.children && item.children.length > 0

  const handleClick = () => {
    if (hasChildren) {
      setIsOpen(!isOpen)
    } else if (item.id) {
      router.push(`/category/${item.id}`)
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
        <span className="truncate">{item.name}</span>
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

interface SidebarProps {}

export function Sidebar({}: SidebarProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <aside className="sticky top-14 h-[calc(100vh-3.5rem)] w-64 shrink-0 overflow-y-auto border-r border-sidebar-border bg-sidebar p-4">
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <AlertCircle className="mb-2 h-6 w-6 text-destructive" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      )}

      {!loading && !error && categories.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <FileText className="mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">暂无分类</p>
        </div>
      )}

      {!loading && !error && categories.length > 0 && (
        <nav className="space-y-1">
          {categories.map((item) => (
            <NavItemComponent
              key={item.id}
              item={item}
            />
          ))}
        </nav>
      )}
    </aside>
  )
}
