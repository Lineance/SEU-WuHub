"use client"

import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { Send, Bot, ExternalLink, Sparkles, X, RotateCcw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet"
import { api } from "@/lib/api"
import { useIsMobile } from "@/hooks/use-mobile"

interface SourceReference {
  title: string
  url: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  sources?: SourceReference[]
}

interface Session {
  id: string
  title: string
  messages: Message[]
  createdAt: string
  updatedAt: string
}

interface AIAssistantProps {
  isOpen: boolean
  onClose: () => void
  sessionId?: string
}

export function AIAssistant({ isOpen, onClose, sessionId }: AIAssistantProps) {
  const [input, setInput] = useState("")
  const [sessions, setSessions] = useState<Session[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [currentThought, setCurrentThought] = useState<string | null>(null)
  const [currentToolCall, setCurrentToolCall] = useState<string | null>(null)
  const [sheetHeight, setSheetHeight] = useState(80) // 初始高度为 80%
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()

  // 获取当前会话
  const currentSession = sessions.find(session => session.id === currentSessionId)
  const messages = currentSession?.messages || []

  // 吸附点定义
  const SNAP_POINTS = [25, 50, 80, 100]

  // 从 localStorage 加载会话列表
  useEffect(() => {
    if (isOpen) {
      try {
        const savedSessions = localStorage.getItem('seu_wuhub_sessions')
        if (savedSessions) {
          try {
            const parsedSessions = JSON.parse(savedSessions) as Session[]
            setSessions(parsedSessions)
            // 检查是否有传入的 sessionId
            if (sessionId && parsedSessions.some(s => s.id === sessionId)) {
              setCurrentSessionId(sessionId)
            } else if (parsedSessions.length > 0) {
              setCurrentSessionId(parsedSessions[0].id)
            } else {
              // 创建默认会话
              const newSession: Session = {
                id: Date.now().toString(),
                title: '新会话',
                messages: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }
              setSessions([newSession])
              setCurrentSessionId(newSession.id)
            }
          } catch (e) {
            console.error('Failed to parse sessions:', e)
            // 创建默认会话
            const newSession: Session = {
              id: Date.now().toString(),
              title: '新会话',
              messages: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
            setSessions([newSession])
            setCurrentSessionId(newSession.id)
          }
        } else {
          // 创建默认会话
          const newSession: Session = {
            id: Date.now().toString(),
            title: '新会话',
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
          setSessions([newSession])
          setCurrentSessionId(newSession.id)
        }
      } catch (e) {
        console.warn('Failed to read sessions from localStorage:', e)
        // 创建默认会话
        const newSession: Session = {
          id: Date.now().toString(),
          title: '新会话',
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        setSessions([newSession])
        setCurrentSessionId(newSession.id)
      }
    }
  }, [isOpen, sessionId])

  // 保存会话列表到 localStorage
  useEffect(() => {
    if (isOpen && sessions.length > 0) {
      try {
        localStorage.setItem('seu_wuhub_sessions', JSON.stringify(sessions))
      } catch (e) {
        console.warn('Failed to save sessions to localStorage:', e)
      }
    }
  }, [sessions, isOpen])

  // 自动滚动到底部
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages, currentThought, currentToolCall])

  // 创建新会话
  const createNewSession = () => {
    const newSession: Session = {
      id: Date.now().toString(),
      title: '新会话',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    setSessions(prev => [newSession, ...prev])
    setCurrentSessionId(newSession.id)
  }

  // 生成会话标题
  const generateSessionTitle = async (content: string) => {
    try {
      const response = await api.generateTitle(content)
      if (response && response.title) {
        setSessions(prev => prev.map(session => {
          if (session.id === currentSessionId) {
            return {
              ...session,
              title: response.title,
              updatedAt: new Date().toISOString()
            }
          }
          return session
        }))
      }
    } catch (error) {
      console.error('Failed to generate session title:', error)
    }
  }

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      role: 'user',
      content: input.trim()
    }

    // 更新当前会话的消息
    setSessions(prev => prev.map(session => {
      if (session.id === currentSessionId) {
        return {
          ...session,
          messages: [...session.messages, userMessage],
          updatedAt: new Date().toISOString()
        }
      }
      return session
    }))

    setInput("")
    setIsLoading(true)
    setCurrentThought(null)
    setCurrentToolCall(null)

    try {
      // 获取最近 10 条历史记录
      const history = messages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      const stream = await api.chatWithAI(userMessage.content, history)

      let assistantContent = ""
      let assistantSources: SourceReference[] = []

      for await (const event of stream) {
        if (event.type === 'thought') {
          setCurrentThought(event.content)
        } else if (event.type === 'tool_call') {
          setCurrentToolCall(event.tool_name)
        } else if (event.type === 'tool_response') {
          // 可以显示工具响应
        } else if (event.type === 'answer') {
          assistantContent = event.content
          assistantSources = event.sources || []
        } else if (event.type === 'done') {
          // Backend may emit sources on done event.
          if (Array.isArray(event.sources) && event.sources.length > 0) {
            assistantSources = event.sources.map((url: string) => ({ title: url, url }))
          }
        } else if (event.type === 'delta') {
          // 流式输出
          assistantContent += event.content

          // 更新当前会话的消息
          setSessions(prev => prev.map(session => {
            if (session.id === currentSessionId) {
              const sessionMessages = [...session.messages]
              // 确保至少有用户消息在那
              if (sessionMessages.length > 0 && sessionMessages[sessionMessages.length - 1].role === 'assistant') {
                sessionMessages[sessionMessages.length - 1] = {
                  role: 'assistant' as const,
                  content: assistantContent,
                  sources: assistantSources
                }
              } else {
                sessionMessages.push({
                  role: 'assistant' as const,
                  content: assistantContent,
                  sources: assistantSources
                })
              }
              return {
                ...session,
                messages: sessionMessages,
                updatedAt: new Date().toISOString()
              }
            }
            return session
          }))
        }
      }

      // 最终消息
      const assistantMessage: Message = {
        role: 'assistant',
        content: assistantContent,
        sources: assistantSources
      }

      // 更新当前会话的消息
      setSessions(prev => prev.map(session => {
        if (session.id === currentSessionId) {
          const sessionMessages = [...session.messages]
          if (sessionMessages[sessionMessages.length - 1]?.role === 'assistant') {
            sessionMessages[sessionMessages.length - 1] = assistantMessage
          } else {
            sessionMessages.push(assistantMessage)
          }
          return {
            ...session,
            messages: sessionMessages,
            updatedAt: new Date().toISOString()
          }
        }
        return session
      }))

      // 如果是新会话的第一条消息，生成标题
      if (messages.length === 0) {
        generateSessionTitle(userMessage.content)
      }
    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage: Message = {
        role: 'assistant',
        content: '抱歉，出现了错误，请稍后重试。'
      }

      // 更新当前会话的消息
      setSessions(prev => prev.map(session => {
        if (session.id === currentSessionId) {
          return {
            ...session,
            messages: [...session.messages, errorMessage],
            updatedAt: new Date().toISOString()
          }
        }
        return session
      }))
    } finally {
      setIsLoading(false)
      setCurrentThought(null)
      setCurrentToolCall(null)
    }
  }

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 自动聚焦到输入框
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isOpen])

  // 清空当前会话
  const handleClearCurrentSession = () => {
    if (confirm('确定要清空当前对话历史吗？')) {
      setSessions(prev => prev.map(session => {
        if (session.id === currentSessionId) {
          return {
            ...session,
            messages: [],
            updatedAt: new Date().toISOString()
          }
        }
        return session
      }))
    }
  }



  // 聊天界面内容
  const chatInnerContent = (
    <div className="flex h-full flex-col">
      {isMobile && (
        <motion.div
          className="mx-auto mb-4 h-3 w-72 rounded-full bg-muted cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
          onPan={(event, info) => {
            // 算出位移占屏幕高度的百分比（注意 y 的正负：往下拉 info.delta.y 为正，高度应减小）
            const deltaPercent = (info.delta.y / window.innerHeight) * 100;
            setSheetHeight(prev => {
              const newHeight = prev - deltaPercent;
              return Math.max(20, Math.min(100, newHeight));
            });
          }}
          onPanEnd={() => {
            // 计算离哪个吸附点最近
            const closest = SNAP_POINTS.reduce((prev, curr) =>
              Math.abs(curr - sheetHeight) < Math.abs(prev - sheetHeight) ? curr : prev
            );
            setSheetHeight(closest);
          }}
        />
      )}
      <div className="border-b border-border pb-4">
        <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                  <Bot className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="flex flex-col">
                  <h3 className="text-base font-semibold text-card-foreground">AI 助手</h3>
                  {currentSession && (
                    <p className="text-xs text-muted-foreground truncate">{currentSession.title}</p>
                  )}
                </div>
                <Sparkles className="h-4 w-4 text-accent" />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={createNewSession}
                  className="h-11 w-11 rounded-full hover:bg-secondary"
                  title="新会话"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClearCurrentSession}
                  className="h-11 w-11 rounded-full hover:bg-secondary"
                  title="清空对话"
                >
                  <RotateCcw className="h-6 w-6" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-11 w-11 rounded-full hover:bg-secondary"
                >
                  <X className="h-6 w-6" />
                </Button>
              </div>
            </div>
      </div>
      <div ref={chatContainerRef} className="mb-4 flex-1 overflow-y-auto">
        {messages.length === 0 && !isLoading && (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
            <Bot className="mb-3 h-12 w-12 opacity-50" />
            <p className="text-sm">有什么问题？</p>
            <p className="text-xs">我可以帮你搜索校园信息</p>
          </div>
        )}

        {messages.map((message, index) => (
          <div key={index} className={`mb-4 ${message.role === 'user' ? 'flex justify-end' : 'flex'}`}>
            <div className={`max-w-[80%] rounded-lg p-3 text-sm ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
              {message.content}
              {message.sources && message.sources.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">参考来源</p>
                  {message.sources.map((source, sourceIndex) => (
                    <a
                      key={sourceIndex}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 rounded-md border border-border p-1 text-xs text-foreground transition-colors hover:bg-secondary"
                    >
                      <ExternalLink className="h-3 w-3 text-primary" />
                      {source.title}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {currentThought && (
          <div className="mb-4 flex">
            <div className="max-w-[80%] rounded-lg bg-secondary p-3 text-sm text-secondary-foreground">
              <p className="italic">AI 正在思考：{currentThought}</p>
            </div>
          </div>
        )}

        {currentToolCall && (
          <div className="mb-4 flex">
            <div className="max-w-[80%] rounded-lg bg-secondary p-3 text-sm text-secondary-foreground">
              <p>正在调用 [{currentToolCall}]...</p>
            </div>
          </div>
        )}

        {isLoading && !currentThought && !currentToolCall && (
          <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            <div className="animation-delay-150 h-2 w-2 animate-pulse rounded-full bg-primary" />
            <div className="animation-delay-300 h-2 w-2 animate-pulse rounded-full bg-primary" />
            <span>思考中...</span>
          </div>
        )}
      </div>
      <div className="space-y-2">
        <Textarea
          key="ai-assistant-input"
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入你的问题..."
          className="min-h-[80px] resize-none border-border bg-secondary text-sm placeholder:text-muted-foreground focus-visible:ring-primary"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              handleSubmit()
            }
          }}
        />
        <Button
          onClick={handleSubmit}
          disabled={isLoading || !input.trim()}
          className="w-full gap-2"
        >
          <Send className="h-4 w-4" />
          发送
        </Button>
      </div>
    </div>
  )

  // 条件渲染包裹容器
  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent
          side="bottom"
          className="p-4 transition-all duration-300 ease-in-out overflow-hidden flex flex-col [&>button]:hidden"
          style={{
            height: `${sheetHeight}vh`,
            willChange: 'height'
          }}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>AI 助手</SheetTitle>
          </SheetHeader>
          {chatInnerContent}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <div
      className={`fixed right-0 top-0 z-50 h-full w-80 transform transition-transform duration-300 ease-in-out ${isOpen ? "translate-x-0" : "translate-x-full"}`}
    >
      <Card className="h-full rounded-none border-l border-border bg-card shadow-lg">
        <CardContent className="flex h-full flex-col p-4">
          {chatInnerContent}
        </CardContent>
      </Card>
    </div>
  )
}
