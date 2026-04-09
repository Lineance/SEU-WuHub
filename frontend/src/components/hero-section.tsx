"use client"

import { useState, useEffect } from "react"
import { X, ChevronLeft, ChevronRight } from "lucide-react"

const images = [
  "/images/jxsy.jpg",
  "/images/seu.png",
  "/images/Auditorium.webp",
  "/images/lwz_library.webp",
  "/images/gym.jpg",
  "/images/2026.jpg",
]

export function HeroSection() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)

  useEffect(() => {
    if (isPreviewOpen) return

    const interval = setInterval(() => {
      setIsTransitioning(true)
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % images.length)
        setIsTransitioning(false)
      }, 1000)
    }, 5000)

    return () => clearInterval(interval)
  }, [isPreviewOpen])

  const openPreview = () => {
    setPreviewIndex(currentIndex)
    setIsPreviewOpen(true)
  }

  const closePreview = () => {
    setIsPreviewOpen(false)
  }

  const goToPrevious = () => {
    setPreviewIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  const goToNext = () => {
    setPreviewIndex((prev) => (prev + 1) % images.length)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPreviewOpen) return
      
      if (e.key === "Escape") {
        closePreview()
      } else if (e.key === "ArrowLeft") {
        goToPrevious()
      } else if (e.key === "ArrowRight") {
        goToNext()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isPreviewOpen, goToPrevious, goToNext])

  return (
    <>
      <div 
        className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl cursor-pointer"
        onClick={openPreview}
      >
        {images.map((src, index) => (
          <div
            key={index}
            className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${
              index === currentIndex && !isTransitioning
                ? "opacity-100"
                : "opacity-0"
            }`}
            style={{ backgroundImage: `url(${src})` }}
          />
        ))}

        <div className="absolute inset-0 bg-foreground/40" />

        <div className="relative z-10 text-center">
          <h1 className="mb-3 text-5xl font-bold tracking-tight text-white drop-shadow-lg md:text-6xl lg:text-7xl">
            WuHub
          </h1>
          <p className="mx-auto max-w-xl text-base text-white/90 drop-shadow-md md:text-lg lg:text-xl">
            东南大学吴健雄学院的智能信息服务系统
          </p>
        </div>

        <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation()
                setIsTransitioning(true)
                setTimeout(() => {
                  setCurrentIndex(index)
                  setIsTransitioning(false)
                }, 500)
              }}
              className={`h-1.5 w-1.5 rounded-full transition-all ${
                index === currentIndex
                  ? "w-5 bg-white"
                  : "bg-white/50 hover:bg-white/70"
              }`}
              aria-label={`切换到图片 ${index + 1}`}
            />
          ))}
        </div>
      </div>

      {isPreviewOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={closePreview}
        >
          <button
            onClick={closePreview}
            className="absolute top-4 right-4 z-10 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
            aria-label="关闭预览"
          >
            <X className="h-6 w-6" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation()
              goToPrevious()
            }}
            className="absolute left-4 z-10 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70 md:p-3"
            aria-label="上一张"
          >
            <ChevronLeft className="h-6 w-6 md:h-8 md:w-8" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation()
              goToNext()
            }}
            className="absolute right-4 z-10 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70 md:p-3"
            aria-label="下一张"
          >
            <ChevronRight className="h-6 w-6 md:h-8 md:w-8" />
          </button>

          <img
            src={images[previewIndex]}
            alt={`预览图片 ${previewIndex + 1}`}
            className="max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
            {previewIndex + 1} / {images.length}
          </div>
        </div>
      )}
    </>
  )
}
