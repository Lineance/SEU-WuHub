"use client"

import { useState } from "react"
import { Menu } from "lucide-react"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { AIAssistant } from "@/components/ai-assistant"
import { cn } from "@/lib/utils"
import { useReadingMode } from "@/components/reading-mode-provider"
import { useIsMobile } from "@/hooks/use-mobile"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [isAIOpen, setIsAIOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const { isReadingMode } = useReadingMode()
  const isMobile = useIsMobile()

  return (
    <div className="flex h-screen flex-col bg-background">
      <Header 
        onAIToggle={() => setIsAIOpen(!isAIOpen)}
        menuTrigger={isMobile && (
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Menu className="h-5 w-5" />
                <span className="sr-only">菜单</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0">
              <Sidebar
                isCollapsed={false}
                onToggleCollapse={() => {}}
              />
            </SheetContent>
          </Sheet>
        )}
      />
      <div className="flex flex-1 overflow-hidden">
        {!isMobile && (
          <Sidebar
            isCollapsed={isSidebarCollapsed || isReadingMode}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />
        )}
        <main className={cn(
          "flex-1 overflow-auto", 
          isReadingMode && "max-w-6xl mx-auto px-8",
          isMobile && "w-full p-4"
        )}>
          {children}
        </main>
      </div>
      <AIAssistant isOpen={isAIOpen && !isReadingMode} onClose={() => setIsAIOpen(false)} />
    </div>
  )
}