'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Clapperboard, ChevronLeft, ChevronRight, MoreVertical, Play } from '@/shared/icons'
import { useReels } from '@/shared/hooks/useReels'
import type { Reel } from '@/shared/types/reels'
import { reelsFeedHref } from '@/lib/reels/feedHref'

const THUMB_WIDTH = 'w-[118px] sm:w-[132px]'

function ReelThumb({ reel }: { reel: Reel; isFirst?: boolean }) {
  const href = reelsFeedHref({ start: reel.id, feed: 'explore' })
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

    return () => {
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
    }
  }, [hasVideo, reel.id])

  const handleEnter = useCallback(() => {
    const v = videoRef.current
    if (!v || !hasVideo) return
    v.play().catch(() => {})
  }, [hasVideo])

  const handleLeave = useCallback(() => {
    const v = videoRef.current
    if (!v || !hasVideo) return
    v.pause()
    try {
      v.currentTime = 0
    } catch {
      /* ignore */
    }
  }, [hasVideo])

  const showPlayIcon = !hasVideo || !isPlaying

  return (
    <div
      className={`relative shrink-0 ${THUMB_WIDTH} aspect-[9/16] rounded-xl overflow-hidden bg-surface-tertiary shadow-sm ring-1 ring-black/5 group/thumb`}
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
          preload="metadata"
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
  const optionsRef = useRef<HTMLDivElement>(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [isHidden, setIsHidden] = useState(false)

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

  useEffect(() => {
    if (!showOptions) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!optionsRef.current?.contains(event.target as Node)) {
        setShowOptions(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowOptions(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showOptions])

  const scrollStrip = useCallback((direction: 'left' | 'right') => {
    scrollContainerRef.current?.scrollBy({
      left: direction === 'left' ? -220 : 220,
      behavior: 'smooth',
    })
  }, [])

  if (loading) {
    return (
      <div className="rounded-xl border border-border  overflow-hidden shadow-md shadow-gray-200/60">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-primary-100 animate-pulse" />
            <div className="h-4 w-24 rounded bg-surface-tertiary animate-pulse" />
          </div>
          <div className="h-8 w-8 rounded-full bg-surface-secondary animate-pulse" />
        </div>
        <div className="flex gap-3 overflow-hidden px-4 pb-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`shrink-0 ${THUMB_WIDTH} aspect-[9/16] rounded-xl bg-surface-tertiary animate-pulse`}
            />
          ))}
        </div>
      </div>
    )
  }

  if (isHidden || displayReels.length === 0) {
    return null
  }

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-md shadow-gray-200/60">
      <div className="flex items-center justify-between px-4 pt-4 pb-1">
        <h3 className="text-[15px] font-bold text-[#1c1e21] flex items-center gap-2">
          <Clapperboard className="w-5 h-5 text-primary-600 shrink-0" />
          Reels
        </h3>
        <div ref={optionsRef} className="relative">
          <button
            type="button"
            onClick={() => setShowOptions((open) => !open)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-content-secondary transition-colors hover:bg-primary-50 hover:text-orange-500"
            aria-label="More reels options"
            aria-expanded={showOptions}
            aria-haspopup="menu"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {showOptions && (
            <div
              role="menu"
              className="absolute right-0 top-11 z-30 min-w-48 rounded-xl border border-border bg-surface p-1.5 shadow-lg"
            >
              <Link
                href="/reels/explore"
                role="menuitem"
                onClick={() => setShowOptions(false)}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm text-content transition-colors hover:bg-surface-secondary"
              >
                Explore all reels
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setShowOptions(false)
                  setIsHidden(true)
                }}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-content transition-colors hover:bg-surface-secondary"
              >
                Hide suggestion
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="relative pb-2">
        {showLeftArrow && (
          <button
            type="button"
            onClick={() => scrollStrip('left')}
            className="flex absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-9 sm:h-9 bg-surface rounded-full shadow-md items-center justify-center hover:bg-primary-50 transition-colors border border-border"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-primary-600" />
          </button>
        )}
        {showRightArrow && (
          <button
            type="button"
            onClick={() => scrollStrip('right')}
            className="flex absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-9 sm:h-9 bg-surface rounded-full shadow-md items-center justify-center hover:bg-primary-50 transition-colors border border-border"
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
            <ReelThumb key={reel.id} reel={reel} />
          ))}
        </div>
      </div>

      <div className="border-t border-border-subtle py-3">
        <Link
          href="/reels/explore"
          className="block text-center text-sm font-semibold text-primary-600 hover:text-orange-500 hover:underline"
        >
          See all
        </Link>
      </div>
    </div>
  )
}
