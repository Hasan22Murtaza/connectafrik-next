'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  X,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Music,
  Send,
  Pause,
  MoreHorizontal,
  Trash2,
  MessageCircle,
  ChevronDown,
  Eye,
  Link2
} from '@/shared/icons'
import {
  Story,
  StoryReply,
  recordStoryView,
  deleteStory,
  addStoryReaction,
  removeStoryReaction,
  getUserStoryReaction,
  addStoryReply,
  getStoryReplies,
  getStoryViewers
} from '@/features/social/services/storiesService'
import { formatStoryRelativeTime } from './storyRelativeTime'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'react-hot-toast'
import { apiClient } from '@/lib/api-client'
import StoryLinkCard from './StoryLinkCard'
import {
  extractStoryLink,
  isLightStoryBackground,
  type LinkPreviewData,
  type StoryLinkInfo,
} from './storyLinkUtils'
const STORY_DURATION = {
  IMAGE: 5000,
  VIDEO: 15000,
  LINK: 8000,
} as const

const QUICK_REACTIONS = [
  { type: 'like', emoji: '👍' },
  { type: 'dislike', emoji: '👎' },
  { type: 'love', emoji: '❤️' },
  { type: 'laugh', emoji: '😂' },
  { type: 'sad', emoji: '😢' },
] as const

const parseTextOverlay = (overlay: string | object | null | undefined) => {
  if (!overlay) return null
  try {
    return typeof overlay === 'string' ? JSON.parse(overlay) : overlay
  } catch {
    return null
  }
}

interface StoryViewerProps {
  isOpen: boolean
  onClose: () => void
  stories: Story[]
  initialStoryIndex?: number
}

const StoryViewer: React.FC<StoryViewerProps> = ({
  isOpen,
  onClose,
  stories,
  initialStoryIndex = 0
}) => {
  const { user } = useAuth()

  const [currentIndex, setCurrentIndex] = useState(initialStoryIndex)
  const [progress, setProgress] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [activeReaction, setActiveReaction] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replies, setReplies] = useState<StoryReply[]>([])
  const [replyCount, setReplyCount] = useState(0)
  const [repliesLoadedFor, setRepliesLoadedFor] = useState<string | null>(null)
  const [reactionLoadedFor, setReactionLoadedFor] = useState<string | null>(null)
  const [showReplies, setShowReplies] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [viewCount, setViewCount] = useState(0)
  const [linkPreview, setLinkPreview] = useState<LinkPreviewData | null>(null)
  const [linkPreviewLoading, setLinkPreviewLoading] = useState(false)
  /** Bumps every minute so "Just now" → "5m ago" etc. while the viewer is open */
  const [, setRelativeTimeTick] = useState(0)

  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const storyDuration = useRef<number>(STORY_DURATION.IMAGE)
  const repliesEndRef = useRef<HTMLDivElement>(null)
  const progressStartedAtRef = useRef<number>(0)
  const progressAtPauseRef = useRef<number>(0)
  const progressRef = useRef(0)

  const currentStory = stories[currentIndex]
  const isOwnStory = currentStory?.user_id === user?.id
  const textOverlay = useMemo(() => parseTextOverlay(currentStory?.text_overlay), [currentStory?.text_overlay])
  const storyText = (textOverlay?.text || currentStory?.caption || '').trim()
  const isTextStory =
    currentStory?.media_type === 'text' ||
    currentStory?.media_url?.startsWith('gradient:') ||
    !!currentStory?.text_overlay

  const storyLink: StoryLinkInfo | null = useMemo(
    () => extractStoryLink(storyText) || extractStoryLink(currentStory?.caption),
    [storyText, currentStory?.caption]
  )

  const isLinkStory = Boolean(storyLink && (isTextStory || !currentStory?.media_url))

  const goToNext = useCallback(() => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(prev => prev + 1)
    } else {
      onClose()
    }
  }, [currentIndex, stories.length, onClose])

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1)
    }
  }, [currentIndex])

  const togglePause = useCallback(() => setIsPaused(p => !p), [])
  const toggleMute = useCallback(() => setIsMuted(m => !m), [])

  const openStoryLink = useCallback((url: string) => {
    setIsPaused(true)
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const id = window.setInterval(() => setRelativeTimeTick((n) => n + 1), 60_000)
    return () => window.clearInterval(id)
  }, [isOpen])

  useEffect(() => {
    if (isOpen && currentStory?.created_at) setRelativeTimeTick((n) => n + 1)
  }, [isOpen, currentStory?.id, currentStory?.created_at])

  useEffect(() => {
    if (!isOpen || !currentStory) return

    setProgress(0)
    progressRef.current = 0
    progressAtPauseRef.current = 0
    setIsPaused(false)
    setShowMenu(false)
    setReplyText('')
    setShowReplies(false)
    setReplies([])
    setReplyCount(currentStory.reply_count || 0)
    setRepliesLoadedFor(null)
    setActiveReaction(currentStory.user_reaction || null)
    setReactionLoadedFor(currentStory.user_reaction ? currentStory.id : null)
    setLinkPreview(null)
    setLinkPreviewLoading(false)

    if (user && currentStory.user_id !== user.id) {
      recordStoryView(currentStory.id, user.id)
        .then(() => getStoryViewers(currentStory.id))
        .then(viewers => setViewCount(viewers.length))
        .catch(console.error)
    }

    getStoryViewers(currentStory.id)
      .then(viewers => setViewCount(viewers.length))
      .catch(console.error)

    if (storyLink) {
      storyDuration.current = STORY_DURATION.LINK
    } else {
      storyDuration.current = currentStory.media_type === 'video' ? STORY_DURATION.VIDEO : STORY_DURATION.IMAGE
    }

    if (currentStory.media_type === 'video' || currentStory.music_url) {
      setIsMuted(false)
    }
  }, [isOpen, currentStory, user, storyLink])

  useEffect(() => {
    if (!isOpen || !storyLink?.url) {
      setLinkPreview(null)
      setLinkPreviewLoading(false)
      return
    }

    let cancelled = false
    setLinkPreviewLoading(true)

    apiClient
      .get<LinkPreviewData>('/api/link-preview', { url: storyLink.url }, { bypassCache: false })
      .then((data) => {
        if (!cancelled) setLinkPreview(data)
      })
      .catch(() => {
        if (!cancelled) setLinkPreview(null)
      })
      .finally(() => {
        if (!cancelled) setLinkPreviewLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, storyLink?.url])

  useEffect(() => {
    if (!isOpen || !currentStory || isPaused) {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
      if (isPaused) progressAtPauseRef.current = progressRef.current
      return
    }

    const duration = storyDuration.current
    const resumeFrom = progressAtPauseRef.current
    progressStartedAtRef.current = Date.now() - (resumeFrom / 100) * duration

    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - progressStartedAtRef.current
      const newProgress = Math.min((elapsed / duration) * 100, 100)
      progressRef.current = newProgress
      setProgress(newProgress)
      if (newProgress >= 100) {
        progressAtPauseRef.current = 0
        progressRef.current = 0
        goToNext()
      }
    }, 50)

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
    }
  }, [isOpen, currentStory, isPaused, currentIndex, goToNext])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const actions: Record<string, () => void> = {
        ArrowLeft: goToPrev,
        ArrowRight: goToNext,
        ' ': () => { e.preventDefault(); togglePause() },
        Escape: onClose,
        m: toggleMute
      }
      actions[e.key]?.()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, goToPrev, goToNext, togglePause, onClose, toggleMute])

  useEffect(() => {
    const syncMedia = async (ref: HTMLVideoElement | HTMLAudioElement | null) => {
      if (!ref) return
      ref.muted = isMuted
      if (isPaused) {
        ref.pause()
      } else {
        try {
          await ref.play()
        } catch {
          if (!isMuted) {
            ref.muted = true
            setIsMuted(true)
            ref.play().catch(() => {})
          }
        }
      }
    }
    syncMedia(videoRef.current)
    syncMedia(audioRef.current)
  }, [isMuted, isPaused])

  useEffect(() => {
    if (showReplies) {
      setIsPaused(true)
      setTimeout(() => repliesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }, [showReplies, replies.length])

  const loadRepliesIfNeeded = useCallback(async () => {
    if (!currentStory || repliesLoadedFor === currentStory.id) return
    try {
      const fetchedReplies = await getStoryReplies(currentStory.id)
      setReplies(fetchedReplies)
      setReplyCount(fetchedReplies.length)
      setRepliesLoadedFor(currentStory.id)
    } catch (error) {
      console.error('Error loading story replies:', error)
    }
  }, [currentStory, repliesLoadedFor])

  const ensureReactionStateLoaded = useCallback(async () => {
    if (!user || !currentStory || reactionLoadedFor === currentStory.id) return
    try {
      const reaction = await getUserStoryReaction(currentStory.id, user.id)
      setActiveReaction(reaction?.reaction_type || null)
      setReactionLoadedFor(currentStory.id)
    } catch (error) {
      console.error('Error loading story reaction:', error)
    }
  }, [user, currentStory, reactionLoadedFor])

  const handleQuickReaction = async (reactionType: string) => {
    if (!user || !currentStory) return
    try {
      await ensureReactionStateLoaded()

      if (activeReaction === reactionType) {
        await removeStoryReaction(currentStory.id, user.id)
        setActiveReaction(null)
      } else {
        await addStoryReaction(currentStory.id, user.id, reactionType)
        setActiveReaction(reactionType)
      }
      setReactionLoadedFor(currentStory.id)
    } catch (error) {
      console.error('Error toggling reaction:', error)
      toast.error('Could not react')
    }
  }

  const handleSendReply = async () => {
    if (!user || !currentStory || !replyText.trim()) return
    try {
      const reply = await addStoryReply(currentStory.id, user.id, replyText.trim())
      setReplies(prev => [...prev, reply])
      setRepliesLoadedFor(currentStory.id)
      setReplyCount(prev => prev + 1)
      setReplyText('')
      toast.success('Reply sent!')
    } catch (error) {
      console.error('Error sending reply:', error)
      toast.error('Failed to send reply')
    }
  }

  const handleDelete = async () => {
    if (!currentStory || !isOwnStory) return
    setIsDeleting(true)
    try {
      await deleteStory(currentStory.id)
      toast.success('Story deleted')
      stories.length === 1 ? onClose() : goToNext()
    } catch (error) {
      console.error('Error deleting story:', error)
      toast.error('Failed to delete story')
    } finally {
      setIsDeleting(false)
      setShowMenu(false)
    }
  }

  const stopPropagation = (e: React.MouseEvent) => e.stopPropagation()

  const toggleRepliesSheet = useCallback(() => {
    setShowReplies(prev => {
      if (prev) setIsPaused(false)
      if (!prev) loadRepliesIfNeeded()
      return !prev
    })
  }, [loadRepliesIfNeeded])

  if (!isOpen || !currentStory) return null

  const visibleReplyCount = repliesLoadedFor === currentStory.id ? replies.length : replyCount
  const displayText = storyLink ? storyLink.residualText : storyText
  const firstName = (currentStory.user_name || 'User').split(' ')[0]
  const storyCanvasColor =
    currentStory.background_color ||
    (isLinkStory || isTextStory ? '#FFFFFF' : '#000000')
  const lightCanvas = (isLinkStory || isTextStory) && isLightStoryBackground(storyCanvasColor)
  // Text/link stories use the solid color the user picked — do not overlay auto gradients
  const canvasBgStyle =
    isLinkStory || isTextStory
      ? { backgroundColor: storyCanvasColor }
      : undefined
  const chromeText = lightCanvas ? 'text-neutral-900' : 'text-white'
  const chromeMuted = lightCanvas ? 'text-neutral-900/55' : 'text-white/70'
  const chromeBarTrack = lightCanvas ? 'bg-black/20' : 'bg-white/30'
  const chromeBarFill = lightCanvas ? 'bg-neutral-900' : 'bg-white'
  const chromeBtn = lightCanvas
    ? 'bg-black/10 hover:bg-black/15 text-neutral-900'
    : 'bg-white/20 hover:bg-white/30 text-white'
  const chromeRing = lightCanvas ? 'ring-black/20' : 'ring-white/50'

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: storyCanvasColor }}
    >
      {currentIndex > 0 && (
        <button
          onClick={goToPrev}
          className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-black/35 hover:bg-black/50 items-center justify-center text-white transition-colors"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}

      {currentIndex < stories.length - 1 && (
        <button
          onClick={goToNext}
          className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-black/35 hover:bg-black/50 items-center justify-center text-white transition-colors"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}

      <div className="relative h-full w-full">
        <div className="h-full w-full" style={{ backgroundColor: storyCanvasColor }}>
          <div className="relative h-full w-full overflow-hidden" onClick={togglePause}>
            {isLinkStory && storyLink ? (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center px-5 sm:px-8"
                style={canvasBgStyle}
              >
                <StoryLinkCard
                  url={storyLink.url}
                  domain={storyLink.domain}
                  fallbackTitle={storyLink.residualText}
                  fallbackAuthor={currentStory.user_name}
                  fallbackImage={currentStory.user_avatar || currentStory.profile_picture_url || ''}
                  preview={linkPreview}
                  loading={linkPreviewLoading}
                  onOpen={() => openStoryLink(storyLink.url)}
                />
              </div>
            ) : isTextStory ? (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={canvasBgStyle}
              >
                {displayText && (
                  <div
                    className="noto-color-emoji-regular max-w-[85%] px-4 py-3 rounded-lg"
                    style={{
                      fontSize: `${textOverlay?.fontSize || 24}px`,
                      fontFamily: textOverlay?.fontFamily || 'ui-sans-serif, system-ui, sans-serif',
                      color: currentStory.text_color || textOverlay?.color || (lightCanvas ? '#111827' : '#FFFFFF'),
                      backgroundColor: textOverlay?.backgroundColor || 'transparent',
                      textAlign: textOverlay?.align || 'center',
                      fontWeight: textOverlay?.isBold ? 'bold' : 'normal'
                    }}
                  >
                    {displayText}
                  </div>
                )}
              </div>
            ) : currentStory.media_type === 'video' ? (
              <video
                ref={videoRef}
                src={currentStory.media_url ?? undefined}
                className="absolute inset-0 w-full h-full object-cover"
                autoPlay
                loop
                muted={isMuted}
                playsInline
              />
            ) : (
              <img
                src={currentStory.media_url ?? undefined}
                alt="Story"
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}

            <div
              className={`absolute inset-0 pointer-events-none ${
                isLinkStory || isTextStory
                  ? lightCanvas
                    ? 'bg-gradient-to-b from-black/[0.06] via-transparent to-black/[0.08]'
                    : 'bg-gradient-to-b from-black/20 via-transparent to-black/30'
                  : 'bg-gradient-to-b from-black/40 via-transparent to-black/60'
              }`}
            />

            <div className="absolute top-2 md:top-3 left-2 md:left-3 right-2 md:right-3 z-20 flex gap-0.5 md:gap-1">
              {stories.map((_, idx) => (
                <div key={idx} className={`flex-1 h-[2px] md:h-0.5 rounded-full overflow-hidden ${chromeBarTrack}`}>
                  <div
                    className={`h-full rounded-full transition-all duration-100 ${chromeBarFill}`}
                    style={{ width: idx < currentIndex ? '100%' : idx === currentIndex ? `${progress}%` : '0%' }}
                  />
                </div>
              ))}
            </div>

            <div className="absolute top-5 md:top-8 left-2 md:left-3 right-2 md:right-3 z-20 flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-3">
                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden ring-2 ${chromeRing}`}>
                  {currentStory.user_avatar ? (
                    <img src={currentStory.user_avatar} alt={currentStory.user_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-semibold">
                      {currentStory.user_name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <p className={`${chromeText} font-semibold text-xs md:text-sm drop-shadow-sm`}>{currentStory.user_name}</p>
                  <p className={`${chromeMuted} text-[10px] md:text-xs`}>{formatStoryRelativeTime(currentStory.created_at)}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 md:gap-2">
                {isPaused && (
                  <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center ${chromeBtn}`}>
                    <Pause className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  </div>
                )}

                {!isLinkStory && (
                  <button
                    onClick={(e) => { stopPropagation(e); toggleMute() }}
                    className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center transition-colors ${chromeBtn}`}
                  >
                    {isMuted ? <VolumeX className="w-3.5 h-3.5 md:w-4 md:h-4" /> : <Volume2 className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                  </button>
                )}

                {isOwnStory && (
                  <div className="relative">
                    <button
                      onClick={(e) => { stopPropagation(e); setShowMenu(!showMenu) }}
                      className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center transition-colors ${chromeBtn}`}
                    >
                      <MoreHorizontal className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    </button>
                    {showMenu && (
                      <div className="absolute top-10 right-0 bg-gray-800 rounded-lg shadow-xl overflow-hidden min-w-[150px]">
                        <button
                          onClick={(e) => { stopPropagation(e); handleDelete() }}
                          disabled={isDeleting}
                          className="w-full px-4 py-3 text-left text-red-400 hover:bg-gray-700 flex items-center gap-2 text-sm"
                        >
                          <Trash2 className="w-4 h-4" />
                          {isDeleting ? 'Deleting...' : 'Delete Story'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={(e) => { stopPropagation(e); onClose() }}
                  aria-label="Close story"
                  className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center transition-colors ${chromeBtn}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {currentStory.caption && !isTextStory && !isLinkStory && !storyLink && (
              <div className="absolute bottom-28 left-2 md:left-3 right-2 md:right-3 z-20 bg-black/30 backdrop-blur-sm rounded-lg px-2.5 md:px-3 py-1.5 md:py-2">
                <p className="text-white text-xs md:text-sm px-2.5 md:px-3 line-clamp-3">
                  {currentStory.caption}
                </p>
              </div>
            )}

            {!isLinkStory && storyLink && (
              <div className="absolute bottom-28 left-0 right-0 z-20 flex justify-center px-3">
                <button
                  type="button"
                  onClick={(e) => {
                    stopPropagation(e)
                    openStoryLink(storyLink.url)
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-black/55 px-4 py-2 text-[13px] font-medium text-white shadow-lg backdrop-blur-md transition hover:bg-black/70"
                >
                  <Link2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="max-w-[200px] truncate">{storyLink.domain}</span>
                </button>
              </div>
            )}

            {currentStory.music_url && !isLinkStory && (
              <div className="absolute bottom-28 left-2 md:left-3 right-2 md:right-3 z-20">
                <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm rounded-full px-2.5 md:px-3 py-1.5 md:py-2">
                  <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-white/20 flex items-center justify-center animate-spin-slow">
                    <Music className="w-2.5 h-2.5 md:w-3 md:h-3 text-white" />
                  </div>
                  <p className="text-white text-[10px] md:text-xs font-medium truncate flex-1">
                    {currentStory.music_title} {currentStory.music_artist && `• ${currentStory.music_artist}`}
                  </p>
                </div>
                <audio ref={audioRef} src={currentStory.music_url} loop autoPlay muted={isMuted} />
              </div>
            )}

            <div className="absolute bottom-3 md:bottom-4 left-3 md:left-4 right-3 md:right-4 z-20 pb-safe">
              {!isOwnStory ? (
                <div className="space-y-2.5">
                  {visibleReplyCount > 0 && (
                    <button
                      onClick={(e) => { stopPropagation(e); toggleRepliesSheet() }}
                      className="flex items-center gap-1.5 mx-auto px-3 py-1 rounded-full bg-black/40 hover:bg-black/50 transition-colors"
                    >
                      <MessageCircle className="w-3 h-3 text-white/60" />
                      <span className="text-white/60 text-[11px] font-medium">
                        {visibleReplyCount} {visibleReplyCount === 1 ? 'reply' : 'replies'}
                      </span>
                    </button>
                  )}

                  <div className="flex items-center justify-center gap-4 pb-0.5">
                    {QUICK_REACTIONS.map((reaction) => {
                      const selected = activeReaction === reaction.type
                      return (
                        <button
                          key={reaction.type}
                          type="button"
                          onClick={(e) => {
                            stopPropagation(e)
                            handleQuickReaction(reaction.type)
                          }}
                          className={`text-[22px] leading-none transition-transform ${
                            selected ? 'scale-125 drop-shadow-[0_0_8px_rgba(255,255,255,0.45)]' : 'opacity-90 hover:scale-110'
                          }`}
                          aria-label={`React with ${reaction.emoji}`}
                        >
                          {reaction.emoji}
                        </button>
                      )
                    })}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') handleSendReply() }}
                        onClick={stopPropagation}
                        onFocus={() => setIsPaused(true)}
                        onBlur={() => { if (!showReplies) setIsPaused(false) }}
                        placeholder={`Reply to ${firstName}...`}
                        className="w-full bg-black/45 border border-white/10 rounded-full px-4 py-2.5 text-white text-sm placeholder:text-white/45 focus:outline-none focus:border-white/25 transition-colors"
                      />
                    </div>
                    <button
                      onClick={(e) => { stopPropagation(e); handleSendReply() }}
                      disabled={!replyText.trim()}
                      className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center transition-all ${
                        replyText.trim()
                          ? 'bg-primary-500 text-white hover:bg-primary-600 shadow-lg shadow-primary-500/30'
                          : 'bg-primary-500/40 text-white/50'
                      }`}
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-white/60">
                    <Eye className="w-4 h-4" />
                    <span className="text-sm font-medium">{viewCount}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { stopPropagation(e); toggleRepliesSheet() }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all bg-black/40 hover:bg-black/50 text-white/80 ${
                      visibleReplyCount === 0 ? 'text-white/50' : ''
                    }`}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">
                      {visibleReplyCount > 0
                        ? `${visibleReplyCount} ${visibleReplyCount === 1 ? 'Reply' : 'Replies'}`
                        : 'View replies'}
                    </span>
                  </button>
                </div>
              )}
            </div>

            <div
              className={`absolute inset-x-0 bottom-0 z-40 transition-transform duration-300 ease-out ${
                showReplies ? 'translate-y-0' : 'translate-y-full'
              }`}
              onClick={stopPropagation}
            >
              <div className="bg-gray-900/98 backdrop-blur-xl rounded-t-2xl md:rounded-t-3xl shadow-2xl border-t border-white/10"
                style={{ maxHeight: '65%', height: 'auto' }}
              >
                <div className="flex justify-center pt-2.5 pb-1">
                  <div className="w-10 h-1 rounded-full bg-white/30" />
                </div>

                <div className="flex items-center justify-between px-4 pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-white/80" />
                    <h3 className="text-white font-semibold text-sm md:text-base">
                      Replies
                    </h3>
                    <span className="bg-white/15 text-white/80 text-[10px] md:text-xs font-medium px-2 py-0.5 rounded-full">
                      {visibleReplyCount}
                    </span>
                  </div>
                  <button
                    onClick={(e) => { stopPropagation(e); toggleRepliesSheet() }}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                  >
                    <ChevronDown className="w-5 h-5" />
                  </button>
                </div>

                <div className="overflow-y-auto px-4 py-3 space-y-3" style={{ maxHeight: isOwnStory ? 'calc(65vh - 80px)' : 'calc(65vh - 140px)' }}>
                  {replies.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-white/40">
                      <MessageCircle className="w-10 h-10 mb-2" />
                      <p className="text-sm">No replies yet</p>
                    </div>
                  ) : (
                    replies.map((reply) => (
                      <div key={reply.id} className="flex items-start gap-2.5 group">
                        <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white text-xs md:text-sm font-semibold flex-shrink-0 ring-1 ring-white/10">
                          {reply.author_avatar ? (
                            <img src={reply.author_avatar} alt={reply.author_name} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            reply.author_name?.charAt(0).toUpperCase() || '?'
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="bg-white/10 rounded-2xl rounded-tl-md px-3.5 py-2.5">
                            <p className="text-white text-xs md:text-sm font-semibold leading-tight">{reply.author_name}</p>
                            <p className="text-white/90 text-xs md:text-sm mt-0.5 break-words">{reply.content}</p>
                          </div>
                          <p className="text-white/40 text-[10px] md:text-xs mt-1 ml-2">
                            {reply.created_at ? formatStoryRelativeTime(reply.created_at) : ''}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={repliesEndRef} />
                </div>

                {!isOwnStory && (
                  <div className="px-4 py-3 border-t border-white/10">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') handleSendReply() }}
                        onClick={stopPropagation}
                        placeholder={`Reply to ${firstName}...`}
                        className="flex-1 bg-white/10 border border-white/20 rounded-full px-3 md:px-4 py-2 md:py-2.5 text-white text-xs md:text-sm placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                      />
                      <button
                        onClick={(e) => { stopPropagation(e); handleSendReply() }}
                        disabled={!replyText.trim()}
                        className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-colors ${
                          replyText.trim()
                            ? 'bg-primary-500 text-white hover:bg-primary-600'
                            : 'bg-white/10 text-white/30'
                        }`}
                      >
                        <Send className="w-4 h-4 md:w-5 md:h-5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="absolute inset-x-0 top-0 bottom-36 z-10 flex">
              <div className="w-1/3 h-full cursor-pointer" onClick={(e) => { stopPropagation(e); goToPrev() }} />
              <div className="w-1/3 h-full" />
              <div className="w-1/3 h-full cursor-pointer" onClick={(e) => { stopPropagation(e); goToNext() }} />
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

export default StoryViewer
