'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'

interface ImageViewerProps {
  images: string[]
  initialIndex?: number
  isOpen: boolean
  onClose: () => void
}

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const ZOOM_STEP = 0.5

const ImageViewer: React.FC<ImageViewerProps> = ({
  images,
  initialIndex = 0,
  isOpen,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [touchDistance, setTouchDistance] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  // Reset zoom/pan when index changes or viewer opens
  useEffect(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [currentIndex])

  // Sync initialIndex when viewer opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex)
      setZoom(1)
      setPan({ x: 0, y: 0 })
    }
  }, [isOpen, initialIndex])

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case 'ArrowLeft':
          goToPrevious()
          break
        case 'ArrowRight':
          goToNext()
          break
        case '+':
        case '=':
          handleZoomIn()
          break
        case '-':
          handleZoomOut()
          break
        case '0':
          handleResetZoom()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, currentIndex, zoom])

  // Lock body scroll when viewer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const goToNext = useCallback(() => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex((prev) => prev + 1)
    }
  }, [currentIndex, images.length])

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1)
    }
  }, [currentIndex])

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + ZOOM_STEP, MAX_ZOOM))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => {
      const newZoom = Math.max(prev - ZOOM_STEP, MIN_ZOOM)
      if (newZoom === MIN_ZOOM) {
        setPan({ x: 0, y: 0 })
      }
      return newZoom
    })
  }, [])

  const handleResetZoom = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [])

  // Double-click to toggle zoom
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (zoom > 1) {
        handleResetZoom()
      } else {
        setZoom(2.5)
        // Center zoom on click position
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect()
          const clickX = e.clientX - rect.left - rect.width / 2
          const clickY = e.clientY - rect.top - rect.height / 2
          setPan({ x: -clickX * 0.5, y: -clickY * 0.5 })
        }
      }
    },
    [zoom, handleResetZoom]
  )

  // Mouse wheel zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.25 : 0.25
      setZoom((prev) => {
        const newZoom = Math.min(Math.max(prev + delta, MIN_ZOOM), MAX_ZOOM)
        if (newZoom === MIN_ZOOM) {
          setPan({ x: 0, y: 0 })
        }
        return newZoom
      })
    },
    []
  )

  // Panning with mouse drag (only when zoomed)
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (zoom <= 1) return
      e.preventDefault()
      setIsDragging(true)
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    },
    [zoom, pan]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || zoom <= 1) return
      e.preventDefault()
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    },
    [isDragging, zoom, dragStart]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Touch handlers for pinch zoom and pan
  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return null
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        // Pinch start
        const dist = getTouchDistance(e.touches)
        setTouchDistance(dist)
      } else if (e.touches.length === 1 && zoom > 1) {
        // Pan start
        setIsDragging(true)
        setDragStart({
          x: e.touches[0].clientX - pan.x,
          y: e.touches[0].clientY - pan.y,
        })
      }
    },
    [zoom, pan]
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2 && touchDistance !== null) {
        // Pinch zoom
        e.preventDefault()
        const newDist = getTouchDistance(e.touches)
        if (newDist !== null) {
          const scale = newDist / touchDistance
          setZoom((prev) => {
            const newZoom = Math.min(Math.max(prev * scale, MIN_ZOOM), MAX_ZOOM)
            if (newZoom === MIN_ZOOM) {
              setPan({ x: 0, y: 0 })
            }
            return newZoom
          })
          setTouchDistance(newDist)
        }
      } else if (e.touches.length === 1 && isDragging && zoom > 1) {
        // Pan
        setPan({
          x: e.touches[0].clientX - dragStart.x,
          y: e.touches[0].clientY - dragStart.y,
        })
      }
    },
    [touchDistance, isDragging, zoom, dragStart]
  )

  const handleTouchEnd = useCallback(() => {
    setTouchDistance(null)
    setIsDragging(false)
  }, [])

  // Swipe to navigate (only when not zoomed)
  const swipeStartRef = useRef<{ x: number; y: number; time: number } | null>(null)

  const handleSwipeStart = useCallback(
    (e: React.TouchEvent) => {
      if (zoom > 1 || e.touches.length !== 1) return
      swipeStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
      }
    },
    [zoom]
  )

  const handleSwipeEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!swipeStartRef.current || zoom > 1) return
      const endX = e.changedTouches[0].clientX
      const endY = e.changedTouches[0].clientY
      const dx = endX - swipeStartRef.current.x
      const dy = endY - swipeStartRef.current.y
      const dt = Date.now() - swipeStartRef.current.time

      // Fast horizontal swipe
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 400) {
        if (dx < 0) {
          goToNext()
        } else {
          goToPrevious()
        }
      }
      swipeStartRef.current = null
    },
    [zoom, goToNext, goToPrevious]
  )

  if (!isOpen || images.length === 0) return null

  const currentImage = images[currentIndex]
  const hasMultipleImages = images.length > 1

  return (
    <div className="fixed inset-0 z-[9999] flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/95 backdrop-blur-sm"
        onClick={(e) => {
          if (zoom <= 1) onClose()
        }}
      />

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent">
        {/* Left: Counter */}
        <div className="text-white text-sm font-medium">
          {hasMultipleImages && (
            <span className="bg-black/40 px-3 py-1.5 rounded-full">
              {currentIndex + 1} / {images.length}
            </span>
          )}
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            title="Zoom out (-)"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <button
            onClick={handleResetZoom}
            disabled={zoom === 1}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            title="Reset zoom (0)"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          <button
            onClick={handleZoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            title="Zoom in (+)"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <div className="w-px h-5 bg-white/20 mx-1" />
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all"
            title="Close (Esc)"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Zoom percentage indicator */}
      {zoom > 1 && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10">
          <span className="bg-black/50 text-white text-xs px-3 py-1 rounded-full">
            {Math.round(zoom * 100)}%
          </span>
        </div>
      )}

      {/* Previous Arrow */}
      {hasMultipleImages && currentIndex > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            goToPrevious()
          }}
          className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 p-2 sm:p-3 bg-black/40 hover:bg-black/60 text-white rounded-full transition-all shadow-lg group"
          aria-label="Previous image"
        >
          <ChevronLeft className="w-5 h-5 sm:w-7 sm:h-7 group-hover:scale-110 transition-transform" />
        </button>
      )}

      {/* Next Arrow */}
      {hasMultipleImages && currentIndex < images.length - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            goToNext()
          }}
          className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 p-2 sm:p-3 bg-black/40 hover:bg-black/60 text-white rounded-full transition-all shadow-lg group"
          aria-label="Next image"
        >
          <ChevronRight className="w-5 h-5 sm:w-7 sm:h-7 group-hover:scale-110 transition-transform" />
        </button>
      )}

      {/* Image Container */}
      <div
        ref={containerRef}
        className="relative w-full h-full flex items-center justify-center overflow-hidden select-none"
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={(e) => {
          handleTouchStart(e)
          handleSwipeStart(e)
        }}
        onTouchMove={handleTouchMove}
        onTouchEnd={(e) => {
          handleTouchEnd()
          handleSwipeEnd(e)
        }}
        style={{
          cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
          touchAction: 'none',
        }}
      >
        <img
          ref={imageRef}
          src={currentImage}
          alt={`Image ${currentIndex + 1} of ${images.length}`}
          className="max-w-[90vw] max-h-[85vh] object-contain pointer-events-none transition-transform duration-150 ease-out"
          style={{
            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
          }}
          draggable={false}
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.src = ''
            target.alt = 'Failed to load image'
          }}
        />
      </div>
    </div>
  )
}

export default ImageViewer
