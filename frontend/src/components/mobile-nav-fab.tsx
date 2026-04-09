"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface MobileNavFabProps {
  onClick: () => void
  opacity?: number
  isVisible?: boolean
}

export function MobileNavFab({ onClick, opacity = 1, isVisible = true }: MobileNavFabProps) {
  // 1. 初始状态设为 null 或一个标志位，避免使用错误的硬编码坐标
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const [hasInitialized, setHasInitialized] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && !hasInitialized) {
      // 2. 立即计算并设置正确位置
      setPosition({
        x: window.innerWidth - 80,
        y: window.innerHeight - 100
      })
      setHasInitialized(true)
    }
  }, [hasInitialized])

  // 3. 关键修复：如果位置还没初始化，直接不渲染。
  // 这样当它第一次 render 时，position.x 就是正确的，不会产生位移路径。
  if (!hasInitialized || !position) return null

  return (
    <motion.div
      className="fixed top-0 left-0"
      // 4. initial 设为当前位置，配合 opacity 0 实现淡入而不是滑入
      initial={{ 
        x: position.x, 
        y: position.y, 
        opacity: 0, 
        scale: 0 
      }}
      animate={{
        x: position.x,
        y: position.y,
        scale: isVisible ? 1 : 0,
        opacity: isVisible ? opacity : 0
      }}
      drag
      dragConstraints={{
        left: 0,
        right: typeof window !== 'undefined' ? window.innerWidth - 64 : 0,
        top: 0,
        bottom: typeof window !== 'undefined' ? window.innerHeight - 64 : 0
      }}
      onDragEnd={(event, info) => {
        const screenWidth = window.innerWidth
        const screenHeight = window.innerHeight
        const halfScreen = screenWidth / 2
        
        // 吸附逻辑
        const newX = info.point.x < halfScreen ? 16 : screenWidth - 64 - 16
        const newY = Math.max(16, Math.min(info.point.y, screenHeight - 64 - 16))
        
        setPosition({ x: newX, y: newY })
      }}
      transition={{ 
        type: "spring", 
        stiffness: 300, 
        damping: 30,
        // 确保 opacity 和 scale 的变化有动画，但位置在第一次出现时不要有位移感
        opacity: { duration: 0.2 } 
      }}
      style={{
        zIndex: 10000,
        pointerEvents: isVisible ? 'auto' : 'none'
      }}
    >
      <Button
        variant="default"
        size="icon"
        className="h-16 w-16 rounded-full shadow-2xl transition-transform active:scale-90"
        onClick={onClick}
      >
        <ChevronRight className="h-8 w-8" />
      </Button>
    </motion.div>
  )
}