"use client"

import { useState } from "react"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { AIAssistant } from "@/components/ai-assistant"

export default function CategoryLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isAIOpen, setIsAIOpen] = useState(false)

  return (
    <div className="flex h-screen flex-col bg-background">
      <Header onAIToggle={() => setIsAIOpen(!isAIOpen)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
      <AIAssistant isOpen={isAIOpen} onClose={() => setIsAIOpen(false)} />
    </div>
  )
}
