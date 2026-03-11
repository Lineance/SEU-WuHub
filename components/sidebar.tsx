"use client"

import { useState } from "react"
import { ChevronRight, BookOpen, Compass, Bell, Link2, FileText, GraduationCap, Lightbulb, Trophy, Home, HelpCircle, Building, Users, Globe } from "lucide-react"
import { cn } from "@/lib/utils"

interface NavItem {
  title: string
  icon?: React.ReactNode
  children?: NavItem[]
  id?: string
}

const navItems: NavItem[] = [
  {
    title: "首页",
    icon: <Home className="h-4 w-4" />,
    id: "home",
  },
  {
    title: "网站导引",
    icon: <Compass className="h-4 w-4" />,
    id: "guide",
  },
  {
    title: "大学生手册",
    icon: <BookOpen className="h-4 w-4" />,
    id: "handbook",
    children: [
      { title: "新生入门", icon: <GraduationCap className="h-4 w-4" />, id: "freshman" },
      { title: "培养方案", icon: <FileText className="h-4 w-4" />, id: "curriculum" },
      { title: "选课指南", icon: <Lightbulb className="h-4 w-4" />, id: "course-selection" },
      { title: "学习经验", icon: <BookOpen className="h-4 w-4" />, id: "study-tips" },
      { title: "竞赛与科研", icon: <Trophy className="h-4 w-4" />, id: "competitions" },
      { title: "校园生活", icon: <Home className="h-4 w-4" />, id: "campus-life" },
      { title: "常见问题", icon: <HelpCircle className="h-4 w-4" />, id: "faq" },
    ],
  },
  {
    title: "导航",
    icon: <Link2 className="h-4 w-4" />,
    id: "navigation",
    children: [
      { title: "各学院官网导航", icon: <Building className="h-4 w-4" />, id: "college-sites" },
      { title: "各学院老师导航", icon: <Users className="h-4 w-4" />, id: "teachers" },
      { title: "常用校内网站", icon: <Globe className="h-4 w-4" />, id: "campus-sites" },
    ],
  },
  {
    title: "最新通知",
    icon: <Bell className="h-4 w-4" />,
    id: "notifications",
  },
  {
    title: "常用资源",
    icon: <FileText className="h-4 w-4" />,
    id: "resources",
  },
]

interface NavItemComponentProps {
  item: NavItem
  level?: number
  currentPage: string
  onPageChange: (id: string) => void
}

function NavItemComponent({ item, level = 0, currentPage, onPageChange }: NavItemComponentProps) {
  const [isOpen, setIsOpen] = useState(level === 0 && item.children ? true : false)
  const hasChildren = item.children && item.children.length > 0
  const isActive = item.id === currentPage

  const handleClick = () => {
    if (hasChildren) {
      setIsOpen(!isOpen)
    } else if (item.id) {
      onPageChange(item.id)
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
          level > 0 && "ml-4",
          isActive
            ? "bg-primary/10 text-primary font-medium"
            : level > 0
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
        {item.icon}
        <span className="truncate">{item.title}</span>
      </button>
      {hasChildren && isOpen && (
        <div className="mt-1 space-y-1">
          {item.children!.map((child) => (
            <NavItemComponent
              key={child.title}
              item={child}
              level={level + 1}
              currentPage={currentPage}
              onPageChange={onPageChange}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface SidebarProps {
  currentPage: string
  onPageChange: (id: string) => void
}

export function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  return (
    <aside className="sticky top-14 h-[calc(100vh-3.5rem)] w-64 shrink-0 overflow-y-auto border-r border-sidebar-border bg-sidebar p-4">
      <nav className="space-y-1">
        {navItems.map((item) => (
          <NavItemComponent
            key={item.title}
            item={item}
            currentPage={currentPage}
            onPageChange={onPageChange}
          />
        ))}
      </nav>
    </aside>
  )
}
