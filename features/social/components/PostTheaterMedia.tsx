'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2 } from '@/shared/icons'
import { PostDetailVideo } from '@/features/social/components/PostDetailVideo'

const isImageFile = (url: string) =>
  /\.(jpg|jpeg|png|gif|webp|bmp|svg|jfif|avif)(\?|#|$)/i.test(url)

const isVideoFile = (url: string) =>
  /\.(mp4|webm|ogg|avi|mov|wmv|flv|mkv)(\?|#|$)/i.test(url)

interface PostTheaterMediaProps {
  urls: string[]
  onClose: () => void
}

export const PostTheaterMedia: React.FC<PostTheaterMediaProps> = ({ urls, onClose }) => {
  const [index, setIndex] = useState(0)
  const [zoom, setZoom] = useState(1)
  const current = urls[index] ?? urls[0]
  const isImage = current ? isImageFile(current) : false
  const isVideo = current ? isVideoFile(current) : false
  const hasMany = urls.length > 1

  const goPrev = useCallback(() => {
    setIndex((prev) => (prev - 1 + urls.length) % urls.length)
    setZoom(1)
  }, [urls.length])

  const goNext = useCallback(() => {
    setIndex((prev) => (prev + 1) % urls.length)
    setZoom(1)
  }, [urls.length])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft' && hasMany) goPrev()
      if (event.key === 'ArrowRight' && hasMany) goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, hasMany, goPrev, goNext])

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await document.documentElement.requestFullscreen()
      }
    } catch {
      // Fullscreen can be blocked by the browser.
    }
  }

  return (
    <div className="relative flex h-full min-h-0 w-full items-center justify-center bg-black">
      <div className="absolute left-3 top-3 z-20">
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {isImage && (
        <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(4, z + 0.5))}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75"
            aria-label="Toggle fullscreen"
          >
            <Maximize2 className="h-5 w-5" />
          </button>
        </div>
      )}

      {hasMany && (
        <button
          type="button"
          onClick={goPrev}
          className="absolute left-3 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75"
          aria-label="Previous media"
        >
          <ChevronLeft className="h-7 w-7" />
        </button>
      )}

      {hasMany && (
        <button
          type="button"
          onClick={goNext}
          className="absolute right-3 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75"
          aria-label="Next media"
        >
          <ChevronRight className="h-7 w-7" />
        </button>
      )}

      <div className="flex h-full w-full items-center justify-center overflow-hidden p-0 lg:p-8">
        {isImage ? (
          <img
            src={current}
            alt={`Post media ${index + 1}`}
            className="max-h-full max-w-full object-contain select-none"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
            draggable={false}
          />
        ) : isVideo ? (
          <div className="h-full w-full">
            <PostDetailVideo src={current} altIndex={index} fill />
          </div>
        ) : current ? (
          <p className="text-sm text-white/70">This media type cannot be previewed.</p>
        ) : null}
      </div>

      {hasMany && (
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5">
          {urls.map((_, i) => (
            <button
              key={`${urls[i]}-${i}`}
              type="button"
              onClick={() => {
                setIndex(i)
                setZoom(1)
              }}
              className={`h-2 rounded-full transition-all ${
                i === index ? 'w-6 bg-white' : 'w-2 bg-white/40 hover:bg-white/70'
              }`}
              aria-label={`Go to media ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
