"use client"

import { useState } from "react"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { SettingsPage } from "@/components/settings-page"
import { AIAssistant } from "@/components/ai-assistant"

export default function SettingsRoute() {
  const [isAIOpen, setIsAIOpen] = useState(false)

  return (
    <div className="flex h-screen flex-col bg-background">
      <Header onAIToggle={() => setIsAIOpen(!isAIOpen)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <SettingsPage />
        </main>
      </div>
      <AIAssistant isOpen={isAIOpen} onClose={() => setIsAIOpen(false)} />
    </div>
  )
}