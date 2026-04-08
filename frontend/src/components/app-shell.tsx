"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { AIAssistant } from "@/components/ai-assistant"
import { cn } from "@/lib/utils"
import { useReadingMode } from "@/components/reading-mode-provider"
import { useIsMobile } from "@/hooks/use-mobile"
import { MobileNavFab } from "@/components/mobile-nav-fab"
import { Sheet, SheetContent } from "@/components/ui/sheet"

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isAIOpen, setIsAIOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [activeLayer, setActiveLayer] = useState<'main' | 'ai'>('ai')
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const { isReadingMode } = useReadingMode()
  const isMobile = useIsMobile()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get('sessionId')) {
      setIsAIOpen(true)
      setActiveLayer('ai')
    }
  }, [searchParams])

  useEffect(() => {
    if (isReadingMode) {
      setIsSidebarCollapsed(true)
    }
  }, [isReadingMode])

  const handleAIToggle = () => {
    if (!isAIOpen) {
      setIsAIOpen(true)
      if (!isMobile) {
        setActiveLayer('ai')
      }
    } else if (!isMobile && activeLayer === 'main') {
      setActiveLayer('ai')
    } else {
      setIsAIOpen(false)
    }
  }

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed)
  }

  return (
    <div className="flex h-screen flex-col bg-background overflow-hidden font-sans antialiased">
      <Header onAIToggle={handleAIToggle} />

      <div className="flex flex-1 overflow-hidden relative">
        {!isMobile && (
          <Sidebar 
            isCollapsed={isSidebarCollapsed} 
            onToggleCollapse={handleToggleSidebar} 
          />
        )}
        
        <div 
          className={cn(
            "flex-1 overflow-hidden transition-all duration-500 ease-in-out relative flex",
            isMobile ? 'z-0' : (activeLayer === 'main' ? 'z-[40]' : 'z-[10]')
          )}
          onClick={() => {
            if (isMobile) return
            if (isAIOpen && activeLayer === 'ai') {
              setActiveLayer('main')
            }
          }}
        >
          <main className={cn(
            "flex-1 overflow-auto bg-background p-4 md:p-6 transition-all duration-300", 
            isReadingMode && "max-w-4xl mx-auto"
          )}>
            {children}
          </main>
        </div>

        {isMobile && (
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetContent side="left" className="w-[280px] p-0 [&>button]:hidden">
              <Sidebar 
                isCollapsed={false} 
                onToggleCollapse={() => {}} 
                isMobile
                onAgentClick={handleAIToggle}
                onActionClick={() => setIsMobileMenuOpen(false)}
              />
            </SheetContent>
          </Sheet>
        )}

        <AIAssistant 
          isOpen={isAIOpen && !isReadingMode} 
          onClose={() => setIsAIOpen(false)} 
          sessionId={searchParams.get('sessionId') || undefined}
          activeLayer={activeLayer}
          onLayerActivate={() => setActiveLayer('ai')}
        />

        {isMobile && !isReadingMode && (
          <MobileNavFab 
            onClick={() => setIsMobileMenuOpen(true)}
            isVisible={!isAIOpen && !isMobileMenuOpen}
          />
        )}
      </div>
    </div>
  )
}
