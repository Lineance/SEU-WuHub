"use client"

import { useState } from "react"
import { useTheme } from "next-themes"
import { Moon, Sun, Monitor, MessageSquare, Send, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [feedbackType, setFeedbackType] = useState<"bug" | "feature" | "other">("bug")
  const [feedbackTitle, setFeedbackTitle] = useState("")
  const [feedbackContent, setFeedbackContent] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const handleSubmitFeedback = () => {
    if (feedbackTitle && feedbackContent) {
      // 这里可以接入后端 API
      console.log({ type: feedbackType, title: feedbackTitle, content: feedbackContent })
      setSubmitted(true)
      setTimeout(() => {
        setSubmitted(false)
        setFeedbackTitle("")
        setFeedbackContent("")
      }, 3000)
    }
  }

  const themeOptions = [
    { value: "light", label: "浅色", icon: Sun },
    { value: "dark", label: "深色", icon: Moon },
    { value: "system", label: "跟随系统", icon: Monitor },
  ]

  const feedbackTypes = [
    { value: "bug", label: "问题反馈" },
    { value: "feature", label: "功能建议" },
    { value: "other", label: "其他" },
  ]

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">设置</h1>
        <p className="text-muted-foreground">管理您的偏好设置和反馈</p>
      </div>

      {/* 外观设置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sun className="h-5 w-5" />
            外观
          </CardTitle>
          <CardDescription>选择您喜欢的界面主题</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {themeOptions.map((option) => {
              const Icon = option.icon
              return (
                <button
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all",
                    theme === option.value
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50 hover:bg-secondary"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-full",
                      theme === option.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <span
                    className={cn(
                      "text-sm font-medium",
                      theme === option.value ? "text-primary" : "text-foreground"
                    )}
                  >
                    {option.label}
                  </span>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* 反馈 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="h-5 w-5" />
            反馈问题
          </CardTitle>
          <CardDescription>帮助我们改进 WuHub，您的反馈对我们很重要</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 反馈类型 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">反馈类型</label>
            <div className="flex gap-2">
              {feedbackTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setFeedbackType(type.value as "bug" | "feature" | "other")}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
                    feedbackType === type.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  )}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* 标题 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">标题</label>
            <Input
              placeholder="简要描述您的问题或建议"
              value={feedbackTitle}
              onChange={(e) => setFeedbackTitle(e.target.value)}
              className="bg-secondary"
            />
          </div>

          {/* 详细内容 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">详细描述</label>
            <Textarea
              placeholder="请详细描述您遇到的问题或您的建议..."
              value={feedbackContent}
              onChange={(e) => setFeedbackContent(e.target.value)}
              className="min-h-32 resize-none bg-secondary"
            />
          </div>

          {/* 提交按钮 */}
          <Button
            onClick={handleSubmitFeedback}
            disabled={!feedbackTitle || !feedbackContent || submitted}
            className="w-full gap-2"
          >
            {submitted ? (
              "感谢您的反馈！"
            ) : (
              <>
                <Send className="h-4 w-4" />
                提交反馈
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* 关于 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">关于 WuHub</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
            <span className="text-sm text-muted-foreground">版本</span>
            <span className="text-sm font-medium text-foreground">v0.1.0 (Beta)</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
            <span className="text-sm text-muted-foreground">开发团队</span>
            <span className="text-sm font-medium text-foreground">东南大学吴健雄学院学生</span>
          </div>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-lg bg-secondary/50 p-3 transition-colors hover:bg-secondary"
          >
            <span className="text-sm text-muted-foreground">GitHub 仓库</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </a>
        </CardContent>
      </Card>
    </div>
  )
}
