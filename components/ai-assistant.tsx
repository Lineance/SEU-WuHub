"use client"

import { useState } from "react"
import { Send, Bot, ExternalLink, Sparkles, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface SourceReference {
  title: string
  url: string
}

interface AIAssistantProps {
  isOpen: boolean
  onClose: () => void
}

export function AIAssistant({ isOpen, onClose }: AIAssistantProps) {
  const [input, setInput] = useState("")
  const [answer, setAnswer] = useState<string | null>(null)
  const [sources, setSources] = useState<SourceReference[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = () => {
    if (!input.trim()) return
    setIsLoading(true)
    setTimeout(() => {
      setAnswer(
        "根据大学生手册，新生入学后需要完成以下步骤：1）完成学籍注册；2）选择培养方案；3）参加新生教育活动。建议先阅读《新生入门》了解详细流程。"
      )
      setSources([
        { title: "新生入门 - 入学流程", url: "#" },
        { title: "培养方案 - 2024级", url: "#" },
      ])
      setIsLoading(false)
    }, 1000)
  }

  return (
    <div
      className={`fixed right-0 top-0 z-50 h-full w-80 transform transition-transform duration-300 ease-in-out ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <Card className="h-full rounded-none border-l border-border bg-card shadow-lg">
        <CardHeader className="border-b border-border pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-card-foreground">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Bot className="h-5 w-5 text-primary-foreground" />
              </div>
              AI 助手
              <Sparkles className="h-4 w-4 text-accent" />
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-full hover:bg-secondary"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex h-[calc(100%-5rem)] flex-col p-4">
          <div className="mb-4 flex-1 overflow-y-auto">
            {!answer && !isLoading && (
              <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
                <Bot className="mb-3 h-12 w-12 opacity-50" />
                <p className="text-sm">有什么问题？</p>
                <p className="text-xs">我可以帮你搜索校园信息</p>
              </div>
            )}
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                <div className="animation-delay-150 h-2 w-2 animate-pulse rounded-full bg-primary" />
                <div className="animation-delay-300 h-2 w-2 animate-pulse rounded-full bg-primary" />
                <span>思考中...</span>
              </div>
            )}
            {answer && !isLoading && (
              <div className="space-y-4">
                <div className="rounded-lg bg-secondary p-3 text-sm text-secondary-foreground">
                  {answer}
                </div>
                {sources.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">参考来源</p>
                    {sources.map((source, index) => (
                      <a
                        key={index}
                        href={source.url}
                        className="flex items-center gap-2 rounded-md border border-border p-2 text-xs text-foreground transition-colors hover:bg-secondary"
                      >
                        <ExternalLink className="h-3 w-3 text-primary" />
                        {source.title}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Textarea
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
        </CardContent>
      </Card>
    </div>
  )
}
