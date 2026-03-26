"use client"

import { useState, useRef, useEffect } from "react"
import { Calendar, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DatePickerProps {
  selectedDate: string | null
  onSelectDate: (date: string) => void
}

export function DatePicker({ selectedDate, onSelectDate }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const datePickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startDayOfWeek = firstDay.getDay()
    
    const days: (Date | null)[] = []
    
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null)
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i))
    }
    
    return days
  }

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0]
  }

  const handleDateClick = (date: Date) => {
    onSelectDate(formatDate(date))
    setIsOpen(false)
  }

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  }

  const isSelected = (date: Date) => {
    return selectedDate === formatDate(date)
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear()
  }

  const days = getDaysInMonth(currentMonth)
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
  const weekDays = ['日', '一', '二', '三', '四', '五', '六']

  return (
    <div ref={datePickerRef} className="relative">
      <Button
        variant={selectedDate ? 'default' : 'outline'}
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="h-9 px-3"
      >
        <Calendar className="h-4 w-4" />
        <span className="ml-2">
          {selectedDate ? selectedDate : '选择日期'}
        </span>
        <ChevronDown className="ml-2 h-4 w-4" />
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 z-50 w-72 rounded-lg border border-border bg-background p-5 shadow-lg">
          <div className="mb-4 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrevMonth}
            >
              {'<'}
            </Button>
            <div className="text-base font-medium">
              {currentMonth.getFullYear()}年{monthNames[currentMonth.getMonth()]}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNextMonth}
            >
              {'>'}
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-sm text-muted-foreground">
            {weekDays.map((day) => (
              <div key={day} className="py-2">
                {day}
              </div>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-7 gap-2">
            {days.map((day, index) => (
              <div key={index} className="aspect-square">
                {day ? (
                  <button
                    onClick={() => handleDateClick(day)}
                    className={`h-full w-full rounded-md text-base transition-colors hover:bg-accent hover:text-accent-foreground ${
                      isSelected(day) ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground' : ''
                    } ${isToday(day) && !isSelected(day) ? 'border-2 border-primary' : ''}`}
                  >
                    {day.getDate()}
                  </button>
                ) : (
                  <div className="h-full w-full" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
