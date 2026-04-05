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

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isAIOpen, setIsAIOpen] = useState(false)
  const [activeLayer, setActiveLayer] = useState<'main' | 'ai'>('ai')
  const { isReadingMode } = useReadingMode()
  const isMobile = useIsMobile()
  const searchParams = useSearchParams()

  // 监听 URL 自动打开 AI
  useEffect(() => {
    if (searchParams.get('sessionId')) {
      setIsAIOpen(true)
      setActiveLayer('ai')
    }
  }, [searchParams])

  // 处理 Header AI 按钮点击
  const handleAIToggle = () => {
    if (!isAIOpen) {
      // 如果没开：打开并置顶
      setIsAIOpen(true)
      setActiveLayer('ai')
    } else if (activeLayer === 'main') {
      // 如果开了但在后台：强制提到前台
      setActiveLayer('ai')
    } else {
      // 如果开了且在前台：关闭
      setIsAIOpen(false)
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background overflow-hidden font-sans antialiased">
      {/* Header 始终在最顶层 z-50 */}
      <Header onAIToggle={handleAIToggle} />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar：独立于层级切换逻辑外，点击它不会影响置顶状态 */}
        {!isMobile && (
          <Sidebar isCollapsed={isReadingMode} onToggleCollapse={() => {}} />
        )}
        
        {/* 主内容区域包裹器 */}
        <div 
          className={cn(
            "flex-1 overflow-hidden transition-all duration-500 ease-in-out relative flex",
            activeLayer === 'main' ? 'z-[40]' : 'z-[10]'
          )}
          onClick={() => {
            if (isAIOpen && activeLayer === 'ai') {
              setActiveLayer('main')
            }
          }}
        >
          <main className={cn(
            "flex-1 overflow-auto bg-background p-4 md:p-6", 
            isReadingMode && "max-w-4xl mx-auto"
          )}>
            {children}
          </main>
        </div>

        {/* AI 助手 - 独立于主内容容器之外 */}
        <AIAssistant 
          isOpen={isAIOpen && !isReadingMode} 
          onClose={() => setIsAIOpen(false)} 
          sessionId={searchParams.get('sessionId') || undefined}
          activeLayer={activeLayer}
          onLayerActivate={() => setActiveLayer('ai')}
        />

        {/* 移动端适配 */}
        {isMobile && !isReadingMode && (
          <MobileNavFab onClick={() => {}} isVisible={!isAIOpen} />
        )}
      </div>
    </div>
  )
}