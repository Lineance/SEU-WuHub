"use client"

import { useState } from "react"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { HeroSection } from "@/components/hero-section"
import { AIAssistant } from "@/components/ai-assistant"
import { SettingsPage } from "@/components/settings-page"

export default function HomePage() {
  const [isAIOpen, setIsAIOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState("home")

  const renderContent = () => {
    switch (currentPage) {
      case "settings":
        return <SettingsPage />
      case "home":
      default:
        return <HeroSection />
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <Header onAIToggle={() => setIsAIOpen(!isAIOpen)} onSettingsClick={() => setCurrentPage("settings")} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} />
        <main className="flex-1 overflow-auto">
          {renderContent()}
        </main>
      </div>
      <AIAssistant isOpen={isAIOpen} onClose={() => setIsAIOpen(false)} />
    </div>
  )
}
