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
  const [position, setPosition] = useState({ x: 0, y: 0 })

  // 初始化位置，避免在 SSR 中引用 window
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPosition({
        x: window.innerWidth - 80,
        y: window.innerHeight - 150
      })
    }
  }, [])

  if (!isVisible) {
    return null
  }

  return (
    <motion.div
      className="fixed top-0 left-0"
      style={{ 
        x: position.x, 
        y: position.y,
        zIndex: 10000, // 调高 z-index，防止遮挡底部的“发送”按钮
        opacity: opacity
      }}
      drag
      dragConstraints={{ left: 0, right: window.innerWidth - 64, top: 0, bottom: window.innerHeight - 64 }}
      onDragEnd={(event, info) => {
        const screenWidth = window.innerWidth
        const screenHeight = window.innerHeight
        const halfScreen = screenWidth / 2
        
        // 计算新的 x 坐标（左右吸附）
        const newX = info.point.x < halfScreen ? 16 : screenWidth - 64 - 16
        
        // 确保 y 轴不会超出屏幕顶端和底端
        const newY = Math.max(16, Math.min(info.point.y, screenHeight - 64 - 16))
        
        setPosition({
          x: newX,
          y: newY
        })
      }}
      transition={{ type: "spring", stiffness: 200 }}
    >
      <Button
        variant="default"
        size="icon"
        className="h-16 w-16 rounded-full shadow-lg transition-opacity duration-300 hover:opacity-100"
        onClick={onClick}
      >
        <ChevronRight className="h-8 w-8" />
      </Button>
    </motion.div>
  )
}