'use client'

import React, { useEffect } from 'react'
import { X } from 'lucide-react'

interface VideoViewerProps {
  src: string | null
  isOpen: boolean
  onClose: () => void
}

const VideoViewer: React.FC<VideoViewerProps> = ({ src, isOpen, onClose }) => {
  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Lock body scroll when open
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

  if (!isOpen || !src) return null

  return (
    <div className="fixed inset-0 z-[9999] flex" onClick={(e) => e.stopPropagation()}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/95 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-3 right-3 z-10 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all"
        title="Close (Esc)"
        aria-label="Close video"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Video Container */}
      <div className="relative w-full h-full flex items-center justify-center p-4">
        <video
          key={src}
          src={src}
          controls
          autoPlay
          playsInline
          className="max-w-[95vw] max-h-[90vh] rounded-lg bg-black shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          Your browser does not support the video tag.
        </video>
      </div>
    </div>
  )
}

export default VideoViewer
