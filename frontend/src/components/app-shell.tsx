"use client"

import { useState } from "react"
import { Menu, X } from "lucide-react"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { AIAssistant } from "@/components/ai-assistant"
import { cn } from "@/lib/utils"
import { useReadingMode } from "@/components/reading-mode-provider"
import { useIsMobile } from "@/hooks/use-mobile"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet"
import { MobileNavFab } from "@/components/mobile-nav-fab"

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [isAIOpen, setIsAIOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { isReadingMode } = useReadingMode()
  const isMobile = useIsMobile()

  return (
    <div className="flex h-screen flex-col bg-background">
      <Header onAIToggle={() => setIsAIOpen(!isAIOpen)} />
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
      
      {/* 移动端抽屉导航 */}
      {isMobile && (
        <>
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetContent side="left" className="w-[280px] p-0">
              <div className="p-4 flex justify-between items-center border-b">
                <h2 className="text-lg font-semibold">导航</h2>
                <SheetClose asChild>
                  <Button variant="ghost" size="icon">
                    <X className="h-5 w-5" />
                  </Button>
                </SheetClose>
              </div>
              <Sidebar
                isCollapsed={false}
                onToggleCollapse={() => {}}
              />
            </SheetContent>
          </Sheet>
          
          {/* 移动端悬浮导航按钮 */}
          {!isReadingMode && (
            <MobileNavFab onClick={() => setIsMobileMenuOpen(true)} />
          )}
        </>
      )}
      
      <AIAssistant isOpen={isAIOpen && !isReadingMode} onClose={() => setIsAIOpen(false)} />
    </div>
  )
}