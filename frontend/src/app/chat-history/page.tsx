"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, MessageSquare, Clock, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"

interface Session {
  id: string
  title: string
  messages: {
    role: 'user' | 'assistant'
    content: string
  }[]
  createdAt: string
  updatedAt: string
}

export default function ChatHistoryPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [sessions, setSessions] = useState<Session[]>([])

  // 从 localStorage 加载会话列表
  useEffect(() => {
    try {
      const savedSessions = localStorage.getItem('seu_wuhub_sessions')
      if (savedSessions) {
        try {
          const parsedSessions = JSON.parse(savedSessions) as Session[]
          // 按更新时间排序，最新的在前
          const sortedSessions = parsedSessions.sort((a, b) => 
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          )
          setSessions(sortedSessions)
        } catch (e) {
          console.error('Failed to parse sessions:', e)
        }
      }
    } catch (e) {
      console.warn('Failed to read sessions from localStorage:', e)
    }
  }, [])

  // 处理返回按钮点击
  const handleBack = () => {
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push('/')
    }
  }

  // 处理会话卡片点击
  const handleSessionClick = (sessionId: string) => {
    router.push(`/?sessionId=${sessionId}`)
  }

  // 处理删除会话
  const handleDeleteSession = (sessionId: string) => {
    if (confirm('确定要删除此会话吗？')) {
      try {
        const updatedSessions = sessions.filter(session => session.id !== sessionId)
        setSessions(updatedSessions)
        localStorage.setItem('seu_wuhub_sessions', JSON.stringify(updatedSessions))
        toast.success('会话已删除', {
          duration: 3000,
          position: "top-right",
        })
      } catch (e) {
        console.error('删除会话失败:', e)
        toast.error('检测到存储无法写入，为防止数据丢失，建议关闭无痕模式或者启用 cookies', {
          duration: 5000,
          position: "top-right",
        })
      }
    }
  }

  // 格式化时间
  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // 获取第一条消息预览
  const getFirstMessagePreview = (messages: Session['messages']) => {
    if (messages.length === 0) {
      return '无消息'
    }
    const firstMessage = messages[0]
    return firstMessage.content.length > 50 
      ? firstMessage.content.slice(0, 50) + '...' 
      : firstMessage.content
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* 返回按钮 */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleBack}
        className="gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        返回
      </Button>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">历史对话</h1>
        <p className="text-muted-foreground">查看和管理您的历史对话记录</p>
      </div>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-secondary/50 p-12 text-center">
          <MessageSquare className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-medium text-foreground">暂无历史对话</h3>
          <p className="mb-6 text-muted-foreground">开始与 AI 助手对话，历史记录会显示在这里</p>
          <Button onClick={() => router.push('/')}>
            开始对话
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {sessions.map((session) => (
            <Card 
              key={session.id}
              className="cursor-pointer transition-all hover:shadow-md"
              onClick={() => handleSessionClick(session.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base font-semibold text-foreground">
                    {session.title}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteSession(session.id)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <CardDescription className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTime(session.updatedAt)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {getFirstMessagePreview(session.messages)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
