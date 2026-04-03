"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Menu, X } from "lucide-react"
import { usePathname, useSearchParams } from "next/navigation"
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
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // 检测无痕模式
  useEffect(() => {
    const checkStorage = () => {
      try {
        const testKey = "__storage_test__";
        localStorage.setItem(testKey, testKey);
        localStorage.removeItem(testKey);
        return true;
      } catch (e) {
        console.warn("Storage check failed:", e);
        return false;
      }
    };

    if (!checkStorage()) {
      toast.warning("检测到存储无法写入，为防止数据丢失，建议关闭无痕模式或者启用 cookies", {
        duration: 10000,
        position: "top-right",
      });
    }
  }, []); // 确保只在首次挂载时执行

  // 检测 URL 参数中的 sessionId
  useEffect(() => {
    const sessionId = searchParams.get('sessionId');
    if (sessionId) {
      setIsAIOpen(true);
    }
  }, [searchParams]);

  const handleAgentClick = () => {
    setIsMobileMenuOpen(false)
    setIsAIOpen(true)
  }

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
            <SheetContent side="left" className="w-[280px] p-0 [&>button]:hidden">
              <div className="p-4 flex justify-between items-center border-b">
                <h2 className="text-lg font-semibold">导航</h2>
                <SheetClose asChild>
                  <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full hover:bg-secondary">
                    <X className="h-6 w-6" />
                  </Button>
                </SheetClose>
              </div>
              <Sidebar
                isCollapsed={false}
                onToggleCollapse={() => {}}
                isMobile
                onActionClick={() => setIsMobileMenuOpen(false)}
                onAgentClick={handleAgentClick}
              />
            </SheetContent>
          </Sheet>
          
          {/* 移动端悬浮导航按钮 */}
          {!isReadingMode && !isAIOpen && !isMobileMenuOpen && (
            <MobileNavFab 
              onClick={() => setIsMobileMenuOpen(true)} 
              isVisible={!isAIOpen && !isMobileMenuOpen}
            />
          )}
        </>
      )}
      
      <AIAssistant 
        isOpen={isAIOpen && !isReadingMode} 
        onClose={() => setIsAIOpen(false)} 
        sessionId={searchParams.get('sessionId') || undefined}
      />
    </div>
  )
}