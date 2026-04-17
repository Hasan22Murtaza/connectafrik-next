'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Clapperboard, ChevronLeft, ChevronRight, MoreHorizontal, MoreVertical, Play } from 'lucide-react'
import { useReels } from '@/shared/hooks/useReels'
import type { Reel } from '@/shared/types/reels'

const THUMB_WIDTH = 'w-[118px] sm:w-[132px]'

function ReelThumb({ reel, isFirst }: { reel: Reel; isFirst: boolean }) {
  const href = `/memories/explore/feed?start=${encodeURIComponent(reel.id)}`
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const hasVideo = Boolean(reel.video_url?.trim())

  useEffect(() => {
    const v = videoRef.current
    if (!v || !hasVideo) return

    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)

    if (isFirst) {
      const tryPlay = () => {
        v.play().catch(() => setIsPlaying(false))
      }
      if (v.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) tryPlay()
      else v.addEventListener('canplay', tryPlay, { once: true })
    }

    return () => {
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
    }
  }, [hasVideo, isFirst, reel.id])

  const handleEnter = useCallback(() => {
    const v = videoRef.current
    if (!v || !hasVideo) return
    v.play().catch(() => {})
  }, [hasVideo])

  const handleLeave = useCallback(() => {
    const v = videoRef.current
    if (!v || !hasVideo) return
    if (!isFirst) {
      v.pause()
      try {
        v.currentTime = 0
      } catch {
        /* ignore */
      }
    }
  }, [hasVideo, isFirst])

  const showPlayIcon = !hasVideo || !isPlaying

  return (
    <div
      className={`relative shrink-0 ${THUMB_WIDTH} aspect-[9/16] rounded-xl overflow-hidden bg-gray-200 shadow-sm ring-1 ring-black/5 group/thumb`}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {hasVideo ? (
        <video
          ref={videoRef}
          src={reel.video_url}
          poster={reel.thumbnail_url || undefined}
          className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover/thumb:scale-[1.02]"
          muted
          loop
          playsInline
          preload={isFirst ? 'auto' : 'metadata'}
        />
      ) : reel.thumbnail_url ? (
        <img
          src={reel.thumbnail_url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover/thumb:scale-[1.02]"
        />
      ) : (
        <div className="absolute inset-0 h-full w-full bg-gradient-to-b from-gray-700 to-gray-900" />
      )}

      <Link href={href} className="absolute inset-0 z-[1] block">
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20 pointer-events-none" />
        {showPlayIcon && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Play className="h-10 w-10 text-white drop-shadow-md" fill="currentColor" strokeWidth={0} />
          </div>
        )}
      </Link>

      <button
        type="button"
        className="absolute top-1.5 right-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/55 transition-colors"
        aria-label="Reel options"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
    </div>
  )
}

export const FeedReelsStrip: React.FC = () => {
  const reelFilters = useMemo(() => ({ feed: 'explore' as const }), [])
  const sortOptions = useMemo(
    () => ({ field: 'engagement_score' as const, order: 'desc' as const }),
    []
  )
  const { reels, loading } = useReels(reelFilters, sortOptions, { enabled: true })

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(false)

  const displayReels = useMemo(() => reels.slice(0, 16), [reels])

  const checkScrollPosition = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return
    setShowLeftArrow(container.scrollLeft > 12)
    setShowRightArrow(container.scrollLeft < container.scrollWidth - container.clientWidth - 12)
  }, [])

  useEffect(() => {
    checkScrollPosition()
    const container = scrollContainerRef.current
    container?.addEventListener('scroll', checkScrollPosition)
    window.addEventListener('resize', checkScrollPosition)
    return () => {
      container?.removeEventListener('scroll', checkScrollPosition)
      window.removeEventListener('resize', checkScrollPosition)
    }
  }, [checkScrollPosition, displayReels.length, loading])

  const scrollStrip = useCallback((direction: 'left' | 'right') => {
    scrollContainerRef.current?.scrollBy({
      left: direction === 'left' ? -220 : 220,
      behavior: 'smooth',
    })
  }, [])

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-md shadow-gray-200/60">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-primary-100 animate-pulse" />
            <div className="h-4 w-24 rounded bg-gray-200 animate-pulse" />
          </div>
          <div className="h-8 w-8 rounded-full bg-gray-100 animate-pulse" />
        </div>
        <div className="flex gap-3 overflow-hidden px-4 pb-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`shrink-0 ${THUMB_WIDTH} aspect-[9/16] rounded-xl bg-gray-200 animate-pulse`}
            />
          ))}
        </div>
      </div>
    )
  }

  if (displayReels.length === 0) {
    return null
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-md shadow-gray-200/60">
      <div className="flex items-center justify-between px-4 pt-4 pb-1">
        <h3 className="text-[15px] font-bold text-[#1c1e21] flex items-center gap-2">
          <Clapperboard className="w-5 h-5 text-primary-600 shrink-0" />
          Reels
        </h3>
        <Link
          href="/memories/explore"
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-primary-50 hover:text-primary-700"
          aria-label="More reels"
        >
          <MoreHorizontal className="w-5 h-5" />
        </Link>
      </div>

      <div className="relative pb-2">
        {showLeftArrow && (
          <button
            type="button"
            onClick={() => scrollStrip('left')}
            className="flex absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-9 sm:h-9 bg-white rounded-full shadow-md items-center justify-center hover:bg-primary-50 transition-colors border border-gray-200"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-primary-600" />
          </button>
        )}
        {showRightArrow && (
          <button
            type="button"
            onClick={() => scrollStrip('right')}
            className="flex absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-9 sm:h-9 bg-white rounded-full shadow-md items-center justify-center hover:bg-primary-50 transition-colors border border-gray-200"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-primary-600" />
          </button>
        )}

        <div
          ref={scrollContainerRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth px-4 pt-1 pb-3"
        >
          {displayReels.map((reel, index) => (
            <ReelThumb key={reel.id} reel={reel} isFirst={index === 0} />
          ))}
        </div>
      </div>

      <div className="border-t border-gray-100 py-3">
        <Link
          href="/memories/explore"
          className="block text-center text-sm font-semibold text-primary-600 hover:text-primary-700 hover:underline"
        >
          See all
        </Link>
      </div>
    </div>
  )
}
