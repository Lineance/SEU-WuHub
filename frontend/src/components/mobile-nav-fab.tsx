"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface MobileNavFabProps {
  onClick: () => void
  opacity?: number
}

export function MobileNavFab({ onClick, opacity = 1 }: MobileNavFabProps) {
  const [position, setPosition] = useState({ x: 20, y: 200 })

  return (
    <motion.div
      className="fixed bottom-8 z-50"
      style={{ 
        x: position.x, 
        y: position.y,
        zIndex: 1000, // 调高 z-index
        opacity: opacity
      }}
      drag
      dragConstraints={{ left: 0, right: window.innerWidth - 64, top: 0, bottom: window.innerHeight - 64 }}
      onDragEnd={(event, info) => {
        const screenWidth = window.innerWidth
        const halfScreen = screenWidth / 2
        const newX = info.point.x < halfScreen ? 16 : screenWidth - 64 - 16
        
        setPosition({
          x: newX,
          y: info.point.y
        })
      }}
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