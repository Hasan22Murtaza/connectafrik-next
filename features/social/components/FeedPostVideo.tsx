'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { useFeedVideoAutoplay } from '@/features/social/context/FeedVideoAutoplayContext'

type FeedPostVideoLayout = 'single' | 'grid'

interface FeedPostVideoProps {
  id: string
  src: string
  layout: FeedPostVideoLayout
  altIndex: number
}

export const FeedPostVideo: React.FC<FeedPostVideoProps> = ({
  id,
  src,
  layout,
  altIndex,
}) => {
  const autoplay = useFeedVideoAutoplay()
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isMuted, setIsMuted] = useState(true)

  useEffect(() => {
    const video = videoRef.current
    const container = containerRef.current
    if (!video || !container || !autoplay) return
    return autoplay.registerVideo(id, video, container)
  }, [autoplay, id, src])

  const toggleMute = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      const video = videoRef.current
      if (!video) return
      const nextMuted = !video.muted
      video.muted = nextMuted
      setIsMuted(nextMuted)
      autoplay?.setUserUnmuted(id, !nextMuted)
    },
    [autoplay, id]
  )

  const videoClassName =
    layout === 'grid'
      ? 'absolute inset-0 h-full w-full object-cover'
      : 'block w-full h-auto max-h-[min(70dvh,560px)] object-contain bg-black'

  const wrapperClassName =
    layout === 'grid'
      ? 'relative h-full w-full min-h-0 bg-black'
      : 'relative w-full bg-black'

  return (
    <div
      ref={containerRef}
      className={wrapperClassName}
      onClick={(e) => e.stopPropagation()}
    >
      <video
        ref={videoRef}
        src={src}
        muted={isMuted}
        loop
        playsInline
        preload="metadata"
        className={videoClassName}
        aria-label={`Post video ${altIndex + 1}`}
        onError={(e) => {
          const target = e.target as HTMLVideoElement
          target.style.display = 'none'
        }}
      />
      <button
        type="button"
        onClick={toggleMute}
        className="absolute bottom-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
        aria-label={isMuted ? 'Unmute video' : 'Mute video'}
      >
        {isMuted ? (
          <VolumeX className="h-4 w-4" aria-hidden />
        ) : (
          <Volume2 className="h-4 w-4" aria-hidden />
        )}
      </button>
    </div>
  )
}
