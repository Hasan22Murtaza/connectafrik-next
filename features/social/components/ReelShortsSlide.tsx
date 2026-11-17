'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Heart,
  Bookmark,
  MessageCircle,
  Send,
  Play,
  Pause,
  Pencil,
  Trash2,
  MoreVertical,
  Repeat2,
  Volume2,
  VolumeX,
  Link2,
  Flag,
  EyeOff,
  UserPlus,
} from '@/shared/icons'
import { useAuth } from '@/contexts/AuthContext'
import { useReelInteractions } from '@/shared/hooks/useReels'
import { Reel } from '@/shared/types/reels'
import { trackEvent, VideoWatchTracker } from '@/features/social/services/engagementTracking'
import { followUser, unfollowUser } from '@/features/social/services/followService'
import toast from 'react-hot-toast'
import { HeartIcon } from 'lucide-react'

function formatShortCount(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return String(num)
}

function formatFullCount(num: number): string {
  return num.toLocaleString()
}

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
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/90 text-content shadow-sm ring-1 ring-black/5 backdrop-blur-sm transition active:scale-[0.96] sm:h-11 sm:w-11 lg:h-12 lg:w-12 lg:bg-surface-secondary lg:hover:bg-surface-hover'
const actionLabelOverlayClass =
  'max-w-[3.25rem] text-center text-[10px] font-semibold leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] sm:text-[11px]'
const actionLabelOutsideClass =
  'max-w-[3.5rem] text-center text-[11px] font-semibold leading-tight text-content tabular-nums lg:text-xs'

export interface ReelShortsSlideProps {
  reel: Reel
  isActive: boolean
  loadMedia: boolean
  onLikeTracked?: (reelId: string) => void
  onComment: () => void
  onShare: () => void
  isOwner: boolean
  onEdit: () => void
  onDelete: () => void
  onReport?: () => void
  onNotInterested?: () => void
}

const ReelShortsSlide: React.FC<ReelShortsSlideProps> = ({
  reel,
  isActive,
  loadMedia,
  onLikeTracked,
  onComment,
  onShare,
  isOwner,
  onEdit,
  onDelete,
  onReport,
  onNotInterested,
}) => {
  const { user } = useAuth()
  const { toggleLike, toggleSave, toggleRepost, recordView, shareReel, loading: interactionLoading } =
    useReelInteractions(reel.id)

  const videoRef = useRef<HTMLVideoElement>(null)
  const watchTrackerRef = useRef<VideoWatchTracker | null>(null)
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tapCountRef = useRef(0)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const viewRecordedRef = useRef(false)

  const [isPlaying, setIsPlaying] = useState(true)
  const [isMuted, setIsMuted] = useState(false)
  const [progress, setProgress] = useState(0)
  const [mediaError, setMediaError] = useState(false)
  const [isLiked, setIsLiked] = useState(Boolean(reel.is_liked))
  const [isSaved, setIsSaved] = useState(Boolean(reel.is_saved))
  const [isReposted, setIsReposted] = useState(Boolean(reel.is_reposted))
  const [isFollowing, setIsFollowing] = useState(Boolean(reel.is_following))
  const [followBusy, setFollowBusy] = useState(false)
  const [likesCount, setLikesCount] = useState(reel.likes_count)
  const [savesCount, setSavesCount] = useState(reel.saves_count ?? 0)
  const [repostsCount, setRepostsCount] = useState(reel.reposts_count ?? 0)
  const [sharesCount, setSharesCount] = useState(reel.shares_count ?? 0)
  const [showHeartBurst, setShowHeartBurst] = useState(false)
  const [showPlayIcon, setShowPlayIcon] = useState(false)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false)

  const username = reel.profiles?.username || 'user'
  const displayName = reel.profiles?.full_name || username
  const profileHref = `/user/${username}`

  useEffect(() => {
    setIsLiked(Boolean(reel.is_liked))
    setIsSaved(Boolean(reel.is_saved))
    setIsReposted(Boolean(reel.is_reposted))
    setIsFollowing(Boolean(reel.is_following))
    setLikesCount(reel.likes_count)
    setSavesCount(reel.saves_count ?? 0)
    setRepostsCount(reel.reposts_count ?? 0)
    setSharesCount(reel.shares_count ?? 0)
    setMediaError(false)
    setProgress(0)
    viewRecordedRef.current = Boolean(reel.is_viewed)
  }, [reel])

  const releaseWakeLock = useCallback(async () => {
    try {
      await wakeLockRef.current?.release()
    } catch {
      /* no-op */
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
      /* no-op */
    }
  }, [releaseWakeLock])

  useEffect(() => {
    const onVis = () => {
      if (document.hidden && videoRef.current) {
        videoRef.current.pause()
        setIsPlaying(false)
        void releaseWakeLock()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [releaseWakeLock])

  useEffect(() => {
    const v = videoRef.current
    if (!v || !loadMedia) return

    if (isActive) {
      void playVideoPreferUnmuted(v).then((ok) => {
        if (ok) {
          setIsPlaying(true)
          setIsMuted(v.muted)
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
        /* no-op */
      }
      setProgress(0)
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
    if (isPlaying && isActive && user && !viewRecordedRef.current) {
      viewRecordedRef.current = true
      void recordView()
    }
  }, [isPlaying, isActive, user, recordView])

  const togglePlayPause = useCallback(() => {
    const v = videoRef.current
    if (!v || !loadMedia || mediaError) return
    if (v.paused) {
      void playVideoPreferUnmuted(v).then((ok) => {
        if (ok) {
          setIsPlaying(true)
          setIsMuted(v.muted)
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
  }, [loadMedia, mediaError, requestWakeLock, releaseWakeLock])

  const toggleMute = useCallback((e?: React.SyntheticEvent) => {
    e?.stopPropagation()
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setIsMuted(v.muted)
  }, [])

  const runLike = useCallback(
    async (fromDoubleTap: boolean) => {
      if (!user) {
        toast.error('Please sign in to like reels')
        return
      }
      if (fromDoubleTap && isLiked) {
        setShowHeartBurst(true)
        window.setTimeout(() => setShowHeartBurst(false), 900)
        return
      }
      const prevLiked = isLiked
      const prevCount = likesCount
      setIsLiked(!prevLiked)
      setLikesCount((c) => (prevLiked ? Math.max(0, c - 1) : c + 1))
      if (fromDoubleTap) {
        setShowHeartBurst(true)
        window.setTimeout(() => setShowHeartBurst(false), 900)
      }
      try {
        const { success, liked, error } = await toggleLike()
        if (success) {
          setIsLiked(liked)
          setLikesCount(liked ? prevCount + (prevLiked ? 0 : 1) : Math.max(0, prevLiked ? prevCount - 1 : prevCount))
          onLikeTracked?.(reel.id)
        } else {
          setIsLiked(prevLiked)
          setLikesCount(prevCount)
          if (error) toast.error(error)
        }
      } catch {
        setIsLiked(prevLiked)
        setLikesCount(prevCount)
        toast.error('Failed to update like')
      }
    },
    [user, toggleLike, onLikeTracked, reel.id, isLiked, likesCount]
  )

  const handleLikeButton = useCallback(() => {
    void runLike(false)
  }, [runLike])

  const handleSaveButton = useCallback(async () => {
    if (!user) {
      toast.error('Please sign in to save reels')
      return
    }
    const prevSaved = isSaved
    const prevCount = savesCount
    setIsSaved(!prevSaved)
    setSavesCount((c) => (prevSaved ? Math.max(0, c - 1) : c + 1))
    try {
      const { success, saved, error } = await toggleSave()
      if (!success) {
        setIsSaved(prevSaved)
        setSavesCount(prevCount)
        if (error) toast.error(error)
        return
      }
      setIsSaved(saved)
      setSavesCount(saved ? (prevSaved ? prevCount : prevCount + 1) : Math.max(0, prevSaved ? prevCount - 1 : prevCount))
      trackEvent.save(user.id, reel.id, 'reel')
    } catch {
      setIsSaved(prevSaved)
      setSavesCount(prevCount)
      toast.error('Failed to update save')
    }
  }, [user, toggleSave, isSaved, savesCount, reel.id])

  const handleRepostButton = useCallback(async () => {
    if (!user) {
      toast.error('Please sign in to repost reels')
      return
    }
    try {
      const { success, error } = await toggleRepost()
      if (!success) {
        if (error) toast.error(error)
        return
      }
      const wasReposted = isReposted
      setIsReposted(!wasReposted)
      setRepostsCount((c) => (wasReposted ? Math.max(0, c - 1) : c + 1))
      if (!wasReposted) {
        trackEvent.share(user.id, reel.id, 'reel')
        toast.success('Reposted')
      } else {
        toast.success('Removed repost')
      }
    } catch {
      toast.error('Failed to update repost')
    }
  }, [user, toggleRepost, isReposted, reel.id])

  const handleFollow = useCallback(async () => {
    if (!user) {
      toast.error('Please sign in to follow creators')
      return
    }
    if (!reel.author_id || reel.author_id === user.id || followBusy) return
    setFollowBusy(true)
    try {
      if (isFollowing) {
        const ok = await unfollowUser(user.id, reel.author_id)
        if (ok) {
          setIsFollowing(false)
          toast.success('Unfollowed')
        } else toast.error('Could not unfollow')
      } else {
        const ok = await followUser(user.id, reel.author_id)
        if (ok) {
          setIsFollowing(true)
          toast.success('Following')
        } else toast.error('Could not follow')
      }
    } catch {
      toast.error('Failed to update follow')
    } finally {
      setFollowBusy(false)
    }
  }, [user, reel.author_id, isFollowing, followBusy])

  const handleCopyLink = useCallback(async () => {
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/reels/${reel.id}`
        : `/reels/${reel.id}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied')
      if (user) {
        try {
          await shareReel('copy_link')
          setSharesCount((c) => c + 1)
        } catch {
          /* no-op */
        }
      }
    } catch {
      toast.error('Could not copy link')
    }
    setOptionsOpen(false)
  }, [reel.id, user, shareReel])

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
    if (!v) return
    watchTrackerRef.current?.updateProgress(v.currentTime)
    if (v.duration > 0) {
      setProgress(Math.min(1, v.currentTime / v.duration))
    }
  }, [])

  const handleShare = useCallback(async () => {
    let shared = false
    if (user) {
      try {
        await shareReel('copy_link')
        shared = true
      } catch {
        /* no-op */
      }
    }
    if (shared) {
      setSharesCount((c) => c + 1)
    }
    onShare()
  }, [user, shareReel, onShare])

  const captionLine = reel.description?.trim() || reel.title
  const shouldTruncateCaption = captionLine.length > 70

  useEffect(() => {
    setIsCaptionExpanded(false)
  }, [reel.id])

  const likeIcon = (size: string) => (
    <HeartIcon
      className={`${size} ${isLiked ? 'fill-red-600 text-red-600' : ''}`}
      strokeWidth={isLiked ? 0 : 2}
    />
  )

  const creatorRow = (overlay: boolean) => (
    <div className="flex items-center gap-2.5">
      <Link
        href={profileHref}
        className="shrink-0"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {reel.profiles?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={reel.profiles.avatar_url}
            alt=""
            className={`h-9 w-9 rounded-full object-cover sm:h-10 sm:w-10 ${
              overlay ? 'border border-white/25' : 'border border-border'
            }`}
          />
        ) : (
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold sm:h-10 sm:w-10 ${
              overlay
                ? 'border border-white/25 bg-white/15 text-white'
                : 'bg-surface-secondary text-content ring-1 ring-border'
            }`}
          >
            {username.charAt(0).toUpperCase()}
          </div>
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          href={profileHref}
          className={`block truncate text-sm font-bold ${overlay ? 'text-white drop-shadow' : 'text-content'}`}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          @{username}
        </Link>
        {displayName !== username && (
          <p className={`truncate text-xs ${overlay ? 'text-white/85 drop-shadow' : 'text-content-secondary'}`}>
            {displayName}
          </p>
        )}
      </div>
      {!isOwner && user && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            void handleFollow()
          }}
          onPointerDown={(e) => e.stopPropagation()}
          disabled={followBusy}
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition disabled:opacity-60 ${
            overlay
              ? isFollowing
                ? 'bg-white/20 text-white ring-1 ring-white/40'
                : 'bg-white text-black'
              : isFollowing
                ? 'bg-surface-secondary text-content ring-1 ring-border'
                : 'bg-primary-600 text-white'
          }`}
        >
          {isFollowing ? 'Following' : 'Follow'}
        </button>
      )}
    </div>
  )

  const actionButtons = (overlay: boolean) => {
    const labelClass = overlay ? actionLabelOverlayClass : actionLabelOutsideClass
    const iconSize = overlay ? 'h-5 w-5' : 'h-6 w-6'
    return (
      <>
        <button
          type="button"
          onClick={handleLikeButton}
          disabled={interactionLoading}
          className="flex flex-col items-center gap-0.5 disabled:opacity-60 lg:gap-1"
          aria-label={isLiked ? 'Unlike' : 'Like'}
        >
          <span className={actionCircleClass}>{likeIcon(iconSize)}</span>
          <span className={`${labelClass} tabular-nums`}>{formatShortCount(likesCount)}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            onComment()
            if (user?.id) trackEvent.comment(user.id, reel.id, 'reel')
          }}
          className="flex flex-col items-center gap-0.5 lg:gap-1"
          aria-label="Comments"
        >
          <span className={actionCircleClass}>
            <MessageCircle className={iconSize} strokeWidth={2} />
          </span>
          <span className={`${labelClass} tabular-nums`}>{formatFullCount(reel.comments_count ?? 0)}</span>
        </button>
        <button
          type="button"
          onClick={() => void handleSaveButton()}
          disabled={interactionLoading}
          className="flex flex-col items-center gap-0.5 disabled:opacity-60 lg:gap-1"
          aria-label={isSaved ? 'Unsave' : 'Save'}
        >
          <span className={actionCircleClass}>
            <Bookmark
              className={`${iconSize} ${isSaved ? 'fill-content text-content' : ''}`}
              strokeWidth={isSaved ? 0 : 2}
            />
          </span>
          <span className={`${labelClass} tabular-nums`}>{formatShortCount(savesCount)}</span>
        </button>
        <button
          type="button"
          onClick={() => void handleRepostButton()}
          disabled={interactionLoading}
          className="flex flex-col items-center gap-0.5 disabled:opacity-60 lg:gap-1"
          aria-label={isReposted ? 'Undo repost' : 'Repost'}
        >
          <span className={actionCircleClass}>
            <Repeat2 className={`${iconSize} ${isReposted ? 'text-emerald-600' : ''}`} strokeWidth={2} />
          </span>
          <span className={`${labelClass} tabular-nums`}>{formatShortCount(repostsCount)}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            void handleShare()
            if (user?.id) trackEvent.share(user.id, reel.id, 'reel')
          }}
          className="flex flex-col items-center gap-0.5 lg:gap-1"
          aria-label="Share"
        >
          <span className={actionCircleClass}>
            <Send className={iconSize} strokeWidth={2} />
          </span>
          <span className={`${labelClass} tabular-nums`}>{formatShortCount(sharesCount)}</span>
        </button>
        <button
          type="button"
          onClick={() => setOptionsOpen(true)}
          className="flex flex-col items-center gap-0.5 lg:gap-1"
          aria-label="More options"
        >
          <span className={actionCircleClass}>
            <MoreVertical className={iconSize} strokeWidth={2} />
          </span>
        </button>
      </>
    )
  }

  return (
    <section
      className="relative h-[100dvh] w-full shrink-0 snap-start snap-always overflow-hidden bg-white lg:h-[calc(100dvh-4.5rem)]"
      data-reel-slide
      data-reel-id={reel.id}
      aria-label={`Reel: ${reel.title}`}
    >
      <div className="flex h-full w-full items-center justify-center lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-end lg:gap-x-5 lg:px-8 lg:pb-8 lg:pt-6">
        <div className="hidden min-w-0 justify-self-end self-end pb-1 lg:flex lg:w-full lg:max-w-[260px] lg:flex-col">
          {creatorRow(false)}
          <p className="mt-2 text-sm leading-snug text-content">
            <span className={isCaptionExpanded ? '' : 'line-clamp-3'}>{captionLine}</span>{' '}
            {shouldTruncateCaption && (
              <button
                type="button"
                className="inline text-xs font-semibold text-content-secondary underline-offset-2 hover:underline"
                onClick={() => setIsCaptionExpanded((v) => !v)}
              >
                {isCaptionExpanded ? 'less' : 'more'}
              </button>
            )}
          </p>
        </div>

        <div className="relative h-full w-full min-h-0 justify-self-center overflow-hidden bg-black lg:aspect-[9/16] lg:h-[min(82dvh,720px)] lg:w-auto lg:rounded-2xl lg:shadow-xl lg:ring-1 lg:ring-black/10">
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
            {loadMedia && !mediaError ? (
              <video
                ref={videoRef}
                src={reel.video_url}
                poster={reel.thumbnail_url}
                className="h-full w-full object-cover"
                loop
                playsInline
                preload={isActive ? 'auto' : 'metadata'}
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                onError={() => setMediaError(true)}
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center bg-zinc-900 bg-cover bg-center"
                style={
                  !mediaError && reel.thumbnail_url
                    ? { backgroundImage: `url(${reel.thumbnail_url})` }
                    : undefined
                }
              >
                {mediaError && (
                  <p className="px-6 text-center text-sm text-white/80">
                    This video is unavailable
                  </p>
                )}
              </div>
            )}
          </div>

          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70 lg:to-black/20"
            aria-hidden
          />

          <div className="pointer-events-auto absolute left-3 top-3 z-20 flex items-center gap-2 lg:left-4 lg:top-4">
            <button
              type="button"
              onClick={toggleMute}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>

          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 h-0.5 bg-white/20"
            aria-hidden
          >
            <div
              className="h-full bg-white/90 transition-[width] duration-100 ease-linear"
              style={{ width: `${progress * 100}%` }}
            />
          </div>

          {showHeartBurst && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
              <Heart className="h-28 w-28 animate-ping text-white opacity-90 drop-shadow-lg" fill="currentColor" />
            </div>
          )}

          {showPlayIcon && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
              <div className="rounded-full bg-black/45 p-5">
                {isPlaying ? (
                  <Pause className="h-14 w-14 text-white" />
                ) : (
                  <Play className="h-14 w-14 text-white" fill="white" />
                )}
              </div>
            </div>
          )}

          <div className="absolute bottom-0 left-0 z-10 w-full px-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] pr-14 pt-10 lg:hidden">
            {creatorRow(true)}
            <p className="mt-1.5 text-[13px] leading-snug text-white/95 drop-shadow">
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
          </div>

          <div
            className="pointer-events-auto absolute bottom-[max(5.5rem,20%)] right-2 z-20 flex flex-col items-center gap-2 sm:right-3 lg:hidden"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {actionButtons(true)}
          </div>
        </div>

        <div className="hidden min-w-0 justify-self-start self-center lg:flex lg:flex-col lg:items-center lg:gap-3">
          {actionButtons(false)}
        </div>
      </div>

      {optionsOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[60] bg-black/40"
            aria-label="Close menu"
            onClick={() => setOptionsOpen(false)}
          />
          <div className="fixed left-1/2 top-1/2 z-[70] w-[min(100%,300px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-2 shadow-xl">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-content-secondary">
              <MoreVertical className="h-4 w-4" />
              <span className="text-sm font-medium">Reel options</span>
            </div>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-content hover:bg-surface-hover"
              onClick={() => void handleCopyLink()}
            >
              <Link2 className="h-5 w-5" />
              Copy link
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-content hover:bg-surface-hover"
              onClick={() => {
                setOptionsOpen(false)
                void handleShare()
              }}
            >
              <Send className="h-5 w-5" />
              Share reel
            </button>
            {!isOwner && (
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-content hover:bg-surface-hover"
                onClick={() => {
                  setOptionsOpen(false)
                  void handleSaveButton()
                }}
              >
                <Bookmark className="h-5 w-5" />
                {isSaved ? 'Unsave reel' : 'Save reel'}
              </button>
            )}
            {isOwner ? (
              <>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-content hover:bg-surface-hover"
                  onClick={() => {
                    setOptionsOpen(false)
                    onEdit()
                  }}
                >
                  <Pencil className="h-5 w-5" />
                  Edit reel
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-red-500 hover:bg-surface-hover"
                  onClick={() => {
                    setOptionsOpen(false)
                    onDelete()
                  }}
                >
                  <Trash2 className="h-5 w-5" />
                  Delete reel
                </button>
              </>
            ) : (
              <>
                {onNotInterested && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-content hover:bg-surface-hover"
                    onClick={() => {
                      setOptionsOpen(false)
                      onNotInterested()
                    }}
                  >
                    <EyeOff className="h-5 w-5" />
                    Not interested
                  </button>
                )}
                {onReport && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-red-500 hover:bg-surface-hover"
                    onClick={() => {
                      setOptionsOpen(false)
                      onReport()
                    }}
                  >
                    <Flag className="h-5 w-5" />
                    Report reel
                  </button>
                )}
                {!isFollowing && user && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-content hover:bg-surface-hover"
                    onClick={() => {
                      setOptionsOpen(false)
                      void handleFollow()
                    }}
                  >
                    <UserPlus className="h-5 w-5" />
                    Follow @{username}
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </section>
  )
}

export default ReelShortsSlide
