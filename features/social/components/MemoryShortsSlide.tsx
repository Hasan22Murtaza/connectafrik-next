'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Heart,
  MessageCircle,
  Share2,
  Play,
  Pause,
  Pencil,
  Trash2,
  MoreVertical,
  ThumbsUp,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useReelInteractions } from '@/shared/hooks/useReels'
import { Reel } from '@/shared/types/reels'
import { REEL_CATEGORIES } from '@/shared/types/reels'
import { trackEvent, VideoWatchTracker } from '@/features/social/services/engagementTracking'
import toast from 'react-hot-toast'

function formatShortCount(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return String(num)
}

/** Comment-style counts like 1,156 */
function formatFullCount(num: number): string {
  return num.toLocaleString()
}

/** Try unmuted play first; fall back to muted if autoplay policy blocks sound. */
async function playVideoPreferUnmuted(v: HTMLVideoElement): Promise<boolean> {
  v.muted = false
  try {
    await v.play()
    return true
  } catch {
    v.muted = true
    try {
      await v.play()
      return true
    } catch {
      return false
    }
  }
}

const actionCircleClass =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-200/95 text-zinc-900 shadow-[0_1px_3px_rgba(0,0,0,0.25)] backdrop-blur-sm transition active:scale-[0.96] active:bg-zinc-300 sm:h-11 sm:w-11 lg:h-12 lg:w-12 lg:hover:bg-zinc-300'
/** Labels overlaid on video — high contrast on any footage */
const actionLabelOverlayClass =
  'max-w-[3.25rem] text-center text-[10px] font-semibold leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] sm:text-[11px]'
/** Labels beside video on desktop (gray rail) */
const actionLabelOutsideClass =
  'max-w-[3.5rem] text-center text-[11px] font-semibold leading-tight text-zinc-800 lg:text-xs'

export interface MemoryShortsSlideProps {
  reel: Reel
  isActive: boolean
  /** Load video element only when near the active slide (lazy). */
  loadMedia: boolean
  onLikeTracked?: (reelId: string) => void
  onComment: () => void
  onShare: () => void
  isOwner: boolean
  onEdit: () => void
  onDelete: () => void
}

const MemoryShortsSlide: React.FC<MemoryShortsSlideProps> = ({
  reel,
  isActive,
  loadMedia,
  onLikeTracked,
  onComment,
  onShare,
  isOwner,
  onEdit,
  onDelete,
}) => {
  const { user } = useAuth()
  const { toggleLike, recordView, shareReel, loading: interactionLoading } = useReelInteractions(reel.id)

  const videoRef = useRef<HTMLVideoElement>(null)
  const watchTrackerRef = useRef<VideoWatchTracker | null>(null)
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tapCountRef = useRef(0)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  const [isPlaying, setIsPlaying] = useState(true)
  const [isLiked, setIsLiked] = useState(false)
  const [likesCount, setLikesCount] = useState(reel.likes_count)
  const [showHeartBurst, setShowHeartBurst] = useState(false)
  const [showPlayIcon, setShowPlayIcon] = useState(false)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false)

  const categoryMeta = REEL_CATEGORIES.find((c) => c.value === reel.category)
  const username = reel.profiles?.username || 'user'
  const displayName = reel.profiles?.full_name || username

  const releaseWakeLock = useCallback(async () => {
    try {
      await wakeLockRef.current?.release()
    } catch {
      /* ignore */
    }
    wakeLockRef.current = null
  }, [])

  const requestWakeLock = useCallback(async () => {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return
    try {
      await releaseWakeLock()
      wakeLockRef.current = await navigator.wakeLock.request('screen')
      wakeLockRef.current.addEventListener('release', () => {
        wakeLockRef.current = null
      })
    } catch {
      /* permission / unsupported */
    }
  }, [releaseWakeLock])

  useEffect(() => {
    const onVis = () => {
      if (document.hidden && videoRef.current) {
        videoRef.current.pause()
        setIsPlaying(false)
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  useEffect(() => {
    const v = videoRef.current
    if (!v || !loadMedia) return

    if (isActive) {
      void playVideoPreferUnmuted(v).then((ok) => {
        if (ok) {
          setIsPlaying(true)
          void requestWakeLock()
        } else {
          setIsPlaying(false)
        }
      })
    } else {
      v.pause()
      setIsPlaying(false)
      try {
        v.currentTime = 0
      } catch {
        /* ignore */
      }
      void releaseWakeLock()
      if (videoRef.current) {
        watchTrackerRef.current?.cleanup(videoRef.current.currentTime)
        watchTrackerRef.current = null
      }
    }
  }, [isActive, loadMedia, requestWakeLock, releaseWakeLock])

  useEffect(() => {
    return () => {
      void releaseWakeLock()
      if (videoRef.current) {
        watchTrackerRef.current?.cleanup(videoRef.current.currentTime)
      }
    }
  }, [releaseWakeLock])

  useEffect(() => {
    if (isPlaying && isActive && user) {
      void recordView()
    }
  }, [isPlaying, isActive, user, recordView])

  const togglePlayPause = useCallback(() => {
    const v = videoRef.current
    if (!v || !loadMedia) return
    if (v.paused) {
      void playVideoPreferUnmuted(v).then((ok) => {
        if (ok) {
          setIsPlaying(true)
          setShowPlayIcon(true)
          void requestWakeLock()
          window.setTimeout(() => setShowPlayIcon(false), 600)
        }
      })
    } else {
      v.pause()
      setIsPlaying(false)
      setShowPlayIcon(true)
      void releaseWakeLock()
      window.setTimeout(() => setShowPlayIcon(false), 600)
    }
  }, [loadMedia, requestWakeLock, releaseWakeLock])

  const runLike = useCallback(
    async (fromDoubleTap: boolean) => {
      if (!user) {
        toast.error('Please sign in to like memories')
        return
      }
      if (fromDoubleTap && isLiked) {
        setShowHeartBurst(true)
        window.setTimeout(() => setShowHeartBurst(false), 900)
        return
      }
      try {
        const { success, error } = await toggleLike()
        if (success) {
          const wasLiked = isLiked
          setIsLiked(!wasLiked)
          setLikesCount((c) => (wasLiked ? Math.max(0, c - 1) : c + 1))
          onLikeTracked?.(reel.id)
          if (fromDoubleTap) {
            setShowHeartBurst(true)
            window.setTimeout(() => setShowHeartBurst(false), 900)
          }
        } else if (error) toast.error(error)
      } catch {
        toast.error('Failed to update like')
      }
    },
    [user, toggleLike, onLikeTracked, reel.id, isLiked]
  )

  const handleLikeButton = useCallback(() => {
    void runLike(false)
  }, [runLike])

  const handleVideoAreaTap = useCallback(() => {
    tapCountRef.current += 1
    if (tapCountRef.current === 1) {
      tapTimerRef.current = setTimeout(() => {
        togglePlayPause()
        tapCountRef.current = 0
        tapTimerRef.current = null
      }, 260)
    } else if (tapCountRef.current === 2) {
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current)
        tapTimerRef.current = null
      }
      tapCountRef.current = 0
      void runLike(true)
    }
  }, [togglePlayPause, runLike])

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  const onPointerDown = useCallback(() => {
    clearLongPress()
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null
      setOptionsOpen(true)
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(12)
      }
    }, 520)
  }, [clearLongPress])

  const onPointerUp = useCallback(() => {
    clearLongPress()
  }, [clearLongPress])

  const handleLoadedMetadata = useCallback(() => {
    const v = videoRef.current
    if (!v || !user?.id || !v.duration) return
    watchTrackerRef.current = new VideoWatchTracker(reel.id, user.id, v.duration, 'reel')
  }, [reel.id, user?.id])

  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current
    if (v) watchTrackerRef.current?.updateProgress(v.currentTime)
  }, [])

  const handleShare = useCallback(async () => {
    if (user) {
      try {
        await shareReel('copy_link')
      } catch {
        /* non-blocking */
      }
    }
    onShare()
  }, [user, shareReel, onShare])

  const captionLine = reel.description?.trim() || reel.title
  // Line-based collapse (TikTok-like): keep caption compact by default.
  const shouldTruncateCaption = captionLine.length > 70

  useEffect(() => {
    setIsCaptionExpanded(false)
  }, [reel.id])

  return (
    <section
      className="relative h-[100dvh] w-full shrink-0 snap-start snap-always overflow-hidden bg-black lg:h-[calc(100dvh-4.5rem)] lg:bg-neutral-100"
      data-memory-slide
      data-reel-id={reel.id}
      aria-label={`Memory: ${reel.title}`}
    >
      <div className="relative flex h-full w-full flex-col items-stretch justify-center lg:flex-row lg:items-end lg:justify-center lg:gap-5 lg:px-6 lg:py-4">
        {/* Mobile: full-bleed video + overlaid actions. Desktop: centered phone + external action rail. */}
        <div className="relative h-full w-full min-h-0 shrink-0 overflow-hidden lg:aspect-[9/16] lg:h-[min(92dvh,calc(100dvh-7rem))] lg:max-h-[min(92dvh,calc(100dvh-7rem))] lg:w-auto lg:rounded-2xl lg:bg-black lg:shadow-2xl lg:ring-1 lg:ring-black/10">
          <div
            className="absolute inset-0 touch-manipulation"
            onClick={handleVideoAreaTap}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={onPointerUp}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault()
                togglePlayPause()
              }
            }}
            aria-label={isPlaying ? 'Pause video' : 'Play video'}
          >
            {loadMedia ? (
              <video
                ref={videoRef}
                src={reel.video_url}
                poster={reel.thumbnail_url}
                className="h-full w-full object-cover"
                loop
                playsInline
                preload="metadata"
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
              />
            ) : (
              <div
                className="h-full w-full bg-zinc-900 bg-cover bg-center"
                style={reel.thumbnail_url ? { backgroundImage: `url(${reel.thumbnail_url})` } : undefined}
              />
            )}
          </div>

          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70"
            aria-hidden
          />

          {showHeartBurst && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
              <Heart className="h-28 w-28 text-white drop-shadow-lg animate-ping opacity-90" fill="currentColor" />
            </div>
          )}

          {showPlayIcon && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
              <div className="rounded-full bg-black/45 p-5">
                {isPlaying ? <Pause className="h-14 w-14 text-white" /> : <Play className="h-14 w-14 text-white" fill="white" />}
              </div>
            </div>
          )}

          {/* Bottom info — pr-* on small screens clears overlaid rail; desktop uses external rail so normal padding */}
          <div className="absolute bottom-0 left-0 z-10 w-full px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] pr-14 pt-10 text-left sm:pr-16 lg:px-4 lg:pb-4 lg:pr-4 lg:pt-14">
            <div className="flex items-center gap-2.5">
              {reel.profiles?.avatar_url ? (
                <img
                  src={reel.profiles.avatar_url}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-full border border-white/25 object-cover"
                />
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/15 text-sm font-bold text-white backdrop-blur-sm">
                  {username.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-white drop-shadow-md lg:text-sm">@{username}</p>
                {displayName !== username && (
                  <p className="truncate text-[11px] text-white/85 drop-shadow lg:text-xs">{displayName}</p>
                )}
              </div>
            </div>
            <p className="mt-1.5 text-[13px] leading-snug text-white/95 drop-shadow lg:text-sm">
              <span className={isCaptionExpanded ? '' : 'line-clamp-2'}>{captionLine}</span>{' '}
              {shouldTruncateCaption && (
                <button
                  type="button"
                  className="inline text-[11px] font-semibold text-white/90 underline-offset-2 hover:underline"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsCaptionExpanded((v) => !v)
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {isCaptionExpanded ? 'less' : 'more'}
                </button>
              )}
            </p>
            {reel.description?.trim() && reel.description.trim() !== reel.title && (
              <p className="mt-1 text-[11px] text-white/80 drop-shadow line-clamp-1 lg:text-xs">{reel.title}</p>
            )}
            {(categoryMeta || (reel.tags && reel.tags.length > 0)) && (
              <p className="mt-1.5 text-[10px] text-white/75 drop-shadow lg:text-[11px]">
                {categoryMeta && (
                  <span>
                    {categoryMeta.icon} {categoryMeta.label}
                  </span>
                )}
                {categoryMeta && reel.tags && reel.tags.length > 0 && <span className="mx-1.5">·</span>}
                {reel.tags && reel.tags.length > 0 && (
                  <span className="line-clamp-1">
                    {reel.tags.slice(0, 4).map((t) => (
                      <span key={t} className="mr-2">
                        #{t}
                      </span>
                    ))}
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Mobile / tablet: action rail overlaid on video */}
          <div
            className="pointer-events-auto absolute bottom-[max(5.5rem,20%)] right-2 z-20 flex max-h-[55dvh] touch-manipulation flex-col items-center gap-2 overflow-y-auto overscroll-contain pr-[env(safe-area-inset-right)] sm:right-3 sm:gap-2.5 lg:hidden"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleLikeButton()
              }}
              disabled={interactionLoading}
              className="flex flex-col items-center gap-0.5 disabled:opacity-60"
              aria-label={isLiked ? 'Unlike' : 'Like'}
            >
              <span className={actionCircleClass}>
                <ThumbsUp
                  className={`h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 ${isLiked ? 'fill-sky-600 text-sky-600' : ''}`}
                  strokeWidth={isLiked ? 0 : 2}
                />
              </span>
              <span className={`${actionLabelOverlayClass} tabular-nums`}>{formatShortCount(likesCount)}</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onComment()
                if (user?.id) trackEvent.comment(user.id, reel.id, 'reel')
              }}
              className="flex flex-col items-center gap-0.5"
              aria-label="Comments"
            >
              <span className={actionCircleClass}>
                <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6" strokeWidth={2} />
              </span>
              <span className={`${actionLabelOverlayClass} tabular-nums`}>{formatFullCount(reel.comments_count)}</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                void handleShare()
                if (user?.id) trackEvent.share(user.id, reel.id, 'reel')
              }}
              className="flex flex-col items-center gap-0.5"
              aria-label="Share"
            >
              <span className={actionCircleClass}>
                <Share2 className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6" strokeWidth={2} />
              </span>
              <span className={actionLabelOverlayClass}>Share</span>
            </button>

          </div>
        </div>

        {/* Desktop (lg+): actions outside the video, Shorts-style gray rail */}
        <div className="hidden max-h-[min(92dvh,100%)] shrink-0 flex-col items-center justify-center gap-3 overflow-y-auto overscroll-contain py-1 lg:flex">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleLikeButton()
            }}
            disabled={interactionLoading}
            className="flex flex-col items-center gap-1 disabled:opacity-60"
            aria-label={isLiked ? 'Unlike' : 'Like'}
          >
            <span className={actionCircleClass}>
              <ThumbsUp
                className={`h-6 w-6 ${isLiked ? 'fill-sky-600 text-sky-600' : ''}`}
                strokeWidth={isLiked ? 0 : 2}
              />
            </span>
            <span className={`${actionLabelOutsideClass} tabular-nums`}>{formatShortCount(likesCount)}</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onComment()
              if (user?.id) trackEvent.comment(user.id, reel.id, 'reel')
            }}
            className="flex flex-col items-center gap-1"
            aria-label="Comments"
          >
            <span className={actionCircleClass}>
              <MessageCircle className="h-6 w-6" strokeWidth={2} />
            </span>
            <span className={`${actionLabelOutsideClass} tabular-nums`}>{formatFullCount(reel.comments_count)}</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              void handleShare()
              if (user?.id) trackEvent.share(user.id, reel.id, 'reel')
            }}
            className="flex flex-col items-center gap-1"
            aria-label="Share"
          >
            <span className={actionCircleClass}>
              <Share2 className="h-6 w-6" strokeWidth={2} />
            </span>
            <span className={actionLabelOutsideClass}>Share</span>
          </button>

        </div>
      </div>

      {/* Long-press options */}
      {optionsOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[60] bg-black/40"
            aria-label="Close menu"
            onClick={() => setOptionsOpen(false)}
          />
          <div className="fixed left-1/2 top-1/2 z-[70] w-[min(100%,280px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-zinc-900/95 p-2 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2 text-white/80">
              <MoreVertical className="h-4 w-4" />
              <span className="text-sm font-medium">Memory options</span>
            </div>
            {isOwner ? (
              <>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-white hover:bg-white/10"
                  onClick={() => {
                    setOptionsOpen(false)
                    onEdit()
                  }}
                >
                  <Pencil className="h-5 w-5" />
                  Edit memory
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-red-400 hover:bg-white/10"
                  onClick={() => {
                    setOptionsOpen(false)
                    onDelete()
                  }}
                >
                  <Trash2 className="h-5 w-5" />
                  Delete memory
                </button>
              </>
            ) : (
              <p className="px-3 py-4 text-sm text-white/70">Report and other actions can be added here.</p>
            )}
          </div>
        </>
      )}
    </section>
  )
}

export default MemoryShortsSlide
