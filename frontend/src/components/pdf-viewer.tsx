"use client"

import { FileText, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PdfViewerProps {
  pdfUrl: string
  pdfName?: string
  trigger?: React.ReactNode
  children?: React.ReactNode
}

export function PdfViewer({ pdfUrl, pdfName, trigger, children }: PdfViewerProps) {
  // 转换相对URL为绝对URL
  const getFullUrl = (url: string) => {
    if (url.startsWith("http")) return url

    // 处理 jwc.seu.edu.cn 的相对路径
    if (url.startsWith("/_upload/")) {
      return `https://jwc.seu.edu.cn${url}`
    }

    // 对于 wp_pdf_player viewer.html?file=格式的URL，需要提取file参数中的PDF路径
    if (url.includes("viewer.html?file=")) {
      const fileMatch = url.match(/file=([^&]+)/)
      if (fileMatch) {
        const pdfPath = decodeURIComponent(fileMatch[1])
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

  if (trigger || children) {
    return (
      <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="cursor-pointer">
        {trigger || children}
      </a>
    )
  }

  return (
    <Button variant="outline" size="sm" className="gap-2" asChild>
      <a href={fullUrl} target="_blank" rel="noopener noreferrer">
        <FileText className="h-4 w-4" />
        {pdfName || "查看PDF"}
        <ExternalLink className="h-3 w-3 ml-1" />
      </a>
    </Button>
  )
}

// 从HTML内容中提取PDF链接
export function extractPdfUrls(htmlContent: string): Array<{ url: string; name: string }> {
  const pdfUrls: Array<{ url: string; name: string }> = []

  // 匹配 wp_pdf_player iframe 的 src 属性，提取 PDF 文件路径
  const wpPdfPlayerPattern = /<iframe[^>]*wp_pdf_player[^>]*src=["']([^"']*viewer\.html\?file=([^"']+\.pdf[^"']*))["'][^>]*>/gi
  let match
  while ((match = wpPdfPlayerPattern.exec(htmlContent)) !== null) {
    const pdfPath = match[2]
    if (pdfPath && !pdfUrls.some(p => p.url === pdfPath)) {
      const name = decodeURIComponent(pdfPath.split("/").pop()?.replace(/\.pdf$/i, "") || "PDF文档")
      pdfUrls.push({ url: pdfPath, name })
    }
  }

  // 匹配 wp_pdf_player 插件的PDF链接（旧格式）
  const pdfPlayerPattern = /wp_pdf_player\s*=\s*["']([^"']+\.pdf[^"']*)["']/gi
  while ((match = pdfPlayerPattern.exec(htmlContent)) !== null) {
    const url = match[1]
    const name = decodeURIComponent(url.split("/").pop()?.replace(/\.pdf$/i, "") || "PDF文档")
    if (!pdfUrls.some(p => p.url === url)) {
      pdfUrls.push({ url, name })
    }
  }

  // 匹配普通PDF链接
  const hrefPattern = /href=["']([^"']*\.pdf[^"']*)["']/gi
  while ((match = hrefPattern.exec(htmlContent)) !== null) {
    const url = match[1]
    if (!pdfUrls.some(p => p.url === url) && !url.includes("wp_pdf_player") && !url.includes("viewer.html")) {
      const name = decodeURIComponent(url.split("/").pop()?.replace(/\.pdf$/i, "") || "PDF文档")
      pdfUrls.push({ url, name })
    }
  }

  // 匹配 data-src 或 src 属性中的PDF链接
  const srcPattern = /(?:data-src|src)\s*=\s*["']([^"']*\.pdf[^"']*)["']/gi
  while ((match = srcPattern.exec(htmlContent)) !== null) {
    const url = match[1]
    if (!url.includes("viewer.html") && !pdfUrls.some(p => p.url === url)) {
      const name = decodeURIComponent(url.split("/").pop()?.replace(/\.pdf$/i, "") || "PDF文档")
      pdfUrls.push({ url, name })
    }
  }

  return pdfUrls
}