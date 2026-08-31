'use client'

import React, { useCallback, useRef, useState } from 'react'
import { Play } from '@/shared/icons'

interface PostDetailVideoProps {
  src: string
  altIndex: number
  /** Fill the parent pane (theater / split view). */
  fill?: boolean
}

/** Inline video for the post-detail page: play overlay, then native controls, original aspect ratio. */
export const PostDetailVideo: React.FC<PostDetailVideoProps> = ({ src, altIndex, fill = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasStarted, setHasStarted] = useState(false)

  const startPlayback = useCallback((event: React.MouseEvent) => {
    event.stopPropagation()
    const video = videoRef.current
    if (!video) return
    setHasStarted(true)
    void video.play().catch(() => {
      // Autoplay policies can still block; controls remain available.
    })
  }, [])

  return (
    <div
      className={fill ? 'relative h-full w-full bg-black' : 'relative w-full bg-black'}
      onClick={(event) => event.stopPropagation()}
    >
      <video
        ref={videoRef}
        src={src}
        playsInline
        controls={hasStarted}
        preload="metadata"
        className={
          fill
            ? 'h-full w-full object-contain bg-black'
            : 'block h-auto w-full max-h-[min(80dvh,720px)] object-contain bg-black'
        }
        aria-label={`Post video ${altIndex + 1}`}
        onPlay={() => setHasStarted(true)}
        onError={(event) => {
          const target = event.target as HTMLVideoElement
          target.style.display = 'none'
        }}
      >
        Your browser does not support the video tag.
      </video>
      {!hasStarted && (
        <button
          type="button"
          onClick={startPlayback}
          className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors hover:bg-black/30"
          aria-label="Play video"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-sm sm:h-[4.5rem] sm:w-[4.5rem]">
            <Play className="h-8 w-8 translate-x-0.5 sm:h-9 sm:w-9" aria-hidden />
          </span>
        </button>
      )}
    </div>
  )
}
