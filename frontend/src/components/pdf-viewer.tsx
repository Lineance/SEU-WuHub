"use client"

import { useState } from "react"
import { FileText, X, ExternalLink, Maximize2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface PdfViewerProps {
  pdfUrl: string
  pdfName?: string
  trigger?: React.ReactNode
  children?: React.ReactNode
}

export function PdfViewer({ pdfUrl, pdfName, trigger }: PdfViewerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // 转换相对URL为绝对URL
  const getFullUrl = (url: string) => {
    if (url.startsWith("http")) return url

    // 处理 jwc.seu.edu.cn 的相对路径
    // 对于 PDF 文件路径，直接添加域名
    if (url.startsWith("/_upload/")) {
      return `https://jwc.seu.edu.cn${url}`
    }

    // 对于 wp_pdf_player viewer.html?file=格式的URL，需要提取file参数中的PDF路径
    if (url.includes("viewer.html?file=")) {
      // 提取 file 参数中的 PDF 路径
      const fileMatch = url.match(/file=([^&]+)/)
      if (fileMatch) {
        const pdfPath = decodeURIComponent(fileMatch[1])
        // 递归处理PDF路径
        return getFullUrl(pdfPath)
      }
    }

    // 其他相对路径
    if (url.startsWith("/")) {
      return `https://jwc.seu.edu.cn${url}`
    }

    return url
  }

  const fullUrl = getFullUrl(pdfUrl)

  return (
    <>
      {trigger ? (
        <div onClick={() => setIsOpen(true)} className="cursor-pointer">
          {trigger}
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setIsOpen(true)}
        >
          <FileText className="h-4 w-4" />
          {pdfName || "查看PDF"}
        </Button>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className={isFullscreen ? "max-w-[95vw] max-h-[95vh] h-[95vh]" : "max-w-4xl max-h-[90vh] h-[80vh]"}>
          <DialogHeader className="flex flex-row items-center justify-between">
            <div className="flex flex-col gap-1">
              <DialogTitle className="text-lg">{pdfName || "PDF文档"}</DialogTitle>
              <DialogDescription className="text-xs">
                <Badge variant="secondary" className="text-xs">PDF</Badge>
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsFullscreen(!isFullscreen)}
                title={isFullscreen ? "退出全屏" : "全屏"}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                asChild
                title="在新窗口打开"
              >
                <a href={fullUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden rounded-lg border">
            <iframe
              src={`${fullUrl}#toolbar=1&navpanes=1&scrollbar=1&view=FitH`}
              className="h-full w-full"
              title={pdfName || "PDF文档"}
            />
          </div>

          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>共 {1} 页</span>
            <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
              <a href={fullUrl} download={pdfName || "document.pdf"} target="_blank" rel="noopener noreferrer">
                下载PDF
              </a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// 从HTML内容中提取PDF链接
export function extractPdfUrls(htmlContent: string): Array<{ url: string; name: string }> {
  const pdfUrls: Array<{ url: string; name: string }> = []

  // 匹配 wp_pdf_player iframe 的 src 属性，提取 PDF 文件路径
  // 格式: <iframe class="wp_pdf_player" src="/_js/_portletPlugs/swfPlayer/pdfjs.../viewer.html?file=/_upload/.../xxx.pdf">
  const wpPdfPlayerPattern = /<iframe[^>]*wp_pdf_player[^>]*src=["']([^"']*viewer\.html\?file=([^"']+\.pdf[^"']*))["'][^>]*>/gi
  let match
  while ((match = wpPdfPlayerPattern.exec(htmlContent)) !== null) {
    // match[1] 是完整的 src URL，match[2] 是 PDF 文件路径（URL参数中的值）
    const fullUrl = match[1]
    const pdfPath = match[2]
    if (pdfPath && !pdfUrls.some(p => p.url === pdfPath)) {
      const name = decodeURIComponent(pdfPath.split("/").pop()?.replace(/\.pdf$/i, "") || "PDF文档")
      pdfUrls.push({ url: pdfPath, name, fullUrl })
    }
  }

  // 匹配 wp_pdf_player 插件的PDF链接（旧格式，JavaScript变量赋值）
  const pdfPlayerPattern = /wp_pdf_player\s*=\s*["']([^"']+\.pdf[^"']*)["']/gi
  while ((match = pdfPlayerPattern.exec(htmlContent)) !== null) {
    const url = match[1]
    const name = decodeURIComponent(url.split("/").pop()?.replace(/\.pdf$/i, "") || "PDF文档")
    if (!pdfUrls.some(p => p.url === url)) {
      pdfUrls.push({ url, name })
    }
  }

  // 匹配普通PDF链接 (href到.pdf)
  const hrefPattern = /href=["']([^"']*\.pdf[^"']*)["']/gi
  while ((match = hrefPattern.exec(htmlContent)) !== null) {
    const url = match[1]
    // 跳过已匹配的 wp_pdf_player URL
    if (!pdfUrls.some(p => p.url === url) && !url.includes("wp_pdf_player") && !url.includes("viewer.html")) {
      const name = decodeURIComponent(url.split("/").pop()?.replace(/\.pdf$/i, "") || "PDF文档")
      pdfUrls.push({ url, name })
    }
  }

  // 匹配 data-src 或 src 属性中的PDF链接（直接的PDF文件路径）
  const srcPattern = /(?:data-src|src)\s*=\s*["']([^"']*\.pdf[^"']*)["']/gi
  while ((match = srcPattern.exec(htmlContent)) !== null) {
    const url = match[1]
    // 跳过 viewer.html URL（已在上面处理）
    if (!url.includes("viewer.html") && !pdfUrls.some(p => p.url === url)) {
      const name = decodeURIComponent(url.split("/").pop()?.replace(/\.pdf$/i, "") || "PDF文档")
      pdfUrls.push({ url, name })
    }
  }

  return pdfUrls
}