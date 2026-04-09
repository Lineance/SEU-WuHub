"use client"

import { useState, useEffect } from "react"

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

  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true)
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % images.length)
        setIsTransitioning(false)
      }, 1000)
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl">
      {/* Background images */}
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

      {/* Overlay */}
      <div className="absolute inset-0 bg-foreground/40" />

      {/* Content */}
      <div className="relative z-10 text-center">
        <h1 className="mb-3 text-5xl font-bold tracking-tight text-white drop-shadow-lg md:text-6xl lg:text-7xl">
          WuHub
        </h1>
        <p className="mx-auto max-w-xl text-base text-white/90 drop-shadow-md md:text-lg lg:text-xl">
          东南大学吴健雄学院的智能信息服务系统
        </p>
      </div>

      {/* Image indicators */}
      <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
        {images.map((_, index) => (
          <button
            key={index}
            onClick={() => {
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
  )
}