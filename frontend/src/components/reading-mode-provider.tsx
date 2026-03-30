"use client"

import { createContext, useContext, useState, ReactNode } from "react"

interface ReadingModeContextType {
  isReadingMode: boolean
  toggleReadingMode: () => void
}

const ReadingModeContext = createContext<ReadingModeContextType | undefined>(undefined)

export function ReadingModeProvider({ children }: { children: ReactNode }) {
  const [isReadingMode, setIsReadingMode] = useState(false)

  const toggleReadingMode = () => {
    setIsReadingMode(prev => !prev)
  }

  return (
    <ReadingModeContext.Provider value={{ isReadingMode, toggleReadingMode }}>
      {children}
    </ReadingModeContext.Provider>
  )
}

export function useReadingMode() {
  const context = useContext(ReadingModeContext)
  if (context === undefined) {
    throw new Error("useReadingMode must be used within a ReadingModeProvider")
  }
  return context
}
