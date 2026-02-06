'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  X,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Music,
  Heart,
  Send,
  Pause,
  MoreHorizontal,
  Trash2
} from 'lucide-react'
import {
  Story,
  StoryReply,
  recordStoryView,
  deleteStory,
  addStoryReaction,
  removeStoryReaction,
  getUserStoryReaction,
  addStoryReply,
  getStoryReplies
} from '@/features/social/services/storiesService'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'react-hot-toast'

const STORY_DURATION = {
  IMAGE: 5000,
  VIDEO: 15000
} as const

const formatRelativeTime = (dateString: string): string => {
  const hours = Math.floor((Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60))
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

const parseTextOverlay = (overlay: string | object | null | undefined) => {
  if (!overlay) return null
  return typeof overlay === 'string' ? JSON.parse(overlay) : overlay
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
  const [isMuted, setIsMuted] = useState(true)
  const [showMenu, setShowMenu] = useState(false)
  const [isLiked, setIsLiked] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [replies, setReplies] = useState<StoryReply[]>([])
  const [showReplies, setShowReplies] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const storyDuration = useRef<number>(STORY_DURATION.IMAGE)

  const currentStory = stories[currentIndex]
  const isOwnStory = currentStory?.user_id === user?.id
  const textOverlay = useMemo(() => parseTextOverlay(currentStory?.text_overlay), [currentStory?.text_overlay])
  const isTextStory = currentStory?.media_url?.startsWith('gradient:') || !!currentStory?.text_overlay

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

  useEffect(() => {
    if (!isOpen || !currentStory) return

    setProgress(0)
    setIsPaused(false)
    setShowMenu(false)
    setReplyText('')
    setShowReplies(false)

    if (user && currentStory.user_id !== user.id) {
      recordStoryView(currentStory.id, user.id).catch(console.error)
    }

    if (user) {
      getUserStoryReaction(currentStory.id, user.id)
        .then(reaction => setIsLiked(!!reaction))
        .catch(console.error)
    }

    getStoryReplies(currentStory.id).then(setReplies).catch(console.error)
    storyDuration.current = currentStory.media_type === 'video' ? STORY_DURATION.VIDEO : STORY_DURATION.IMAGE
  }, [isOpen, currentStory, user])

  useEffect(() => {
    if (!isOpen || !currentStory || isPaused) {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
      return
    }

    const startTime = Date.now()
    const duration = storyDuration.current

    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime
      const newProgress = Math.min((elapsed / duration) * 100, 100)
      setProgress(newProgress)
      if (newProgress >= 100) goToNext()
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
    const syncMedia = (ref: HTMLVideoElement | HTMLAudioElement | null) => {
      if (!ref) return
      ref.muted = isMuted
      isPaused ? ref.pause() : ref.play().catch(() => {})
    }
    syncMedia(videoRef.current)
    syncMedia(audioRef.current)
  }, [isMuted, isPaused])

  const handleLike = async () => {
    if (!user || !currentStory) return
    try {
      if (isLiked) {
        await removeStoryReaction(currentStory.id, user.id)
        setIsLiked(false)
      } else {
        await addStoryReaction(currentStory.id, user.id, 'like')
        setIsLiked(true)
      }
    } catch (error) {
      console.error('Error toggling like:', error)
    }
  }

  const handleSendReply = async () => {
    if (!user || !currentStory || !replyText.trim()) return
    try {
      const reply = await addStoryReply(currentStory.id, user.id, replyText.trim())
      setReplies(prev => [...prev, reply])
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

  if (!isOpen || !currentStory) return null

  const glowColor = isTextStory ? (currentStory.background_color || '#2563eb') : '#3b82f6'

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
      >
        <X className="w-6 h-6" />
      </button>

      {currentIndex > 0 && (
        <button
          onClick={goToPrev}
          className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center text-white transition-colors"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}

      {currentIndex < stories.length - 1 && (
        <button
          onClick={goToNext}
          className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center text-white transition-colors"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}

      <div className="relative w-full h-full md:w-[380px] md:h-[680px] md:max-h-[90vh]">
        <div className="w-full h-full bg-black md:bg-gray-900 md:rounded-[32px] md:p-1.5 shadow-2xl">
          <div className="relative w-full h-full md:rounded-[26px] overflow-hidden" onClick={togglePause}>
            {isTextStory ? (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ backgroundColor: currentStory.background_color || '#2563eb' }}
              >
                {textOverlay?.text && (
                  <div
                    className="max-w-[85%] px-4 py-3 rounded-lg"
                    style={{
                      fontSize: `${textOverlay.fontSize || 24}px`,
                      fontFamily: textOverlay.fontFamily || 'ui-sans-serif, system-ui, sans-serif',
                      color: textOverlay.color || '#FFFFFF',
                      backgroundColor: textOverlay.backgroundColor || 'transparent',
                      textAlign: textOverlay.align || 'center',
                      fontWeight: textOverlay.isBold ? 'bold' : 'normal'
                    }}
                  >
                    {textOverlay.text}
                  </div>
                )}
              </div>
            ) : currentStory.media_type === 'video' ? (
              <video
                ref={videoRef}
                src={currentStory.media_url}
                className="absolute inset-0 w-full h-full object-cover"
                autoPlay
                loop
                muted={isMuted}
                playsInline
              />
            ) : (
              <img
                src={currentStory.media_url}
                alt="Story"
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}

            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />

            <div className="absolute top-2 md:top-3 left-2 md:left-3 right-2 md:right-3 z-20 flex gap-0.5 md:gap-1">
              {stories.map((_, idx) => (
                <div key={idx} className="flex-1 h-[2px] md:h-0.5 bg-white/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all duration-100"
                    style={{ width: idx < currentIndex ? '100%' : idx === currentIndex ? `${progress}%` : '0%' }}
                  />
                </div>
              ))}
            </div>

            <div className="absolute top-5 md:top-8 left-2 md:left-3 right-2 md:right-3 z-20 flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden ring-2 ring-white/50">
                  {currentStory.user_avatar ? (
                    <img src={currentStory.user_avatar} alt={currentStory.user_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-semibold">
                      {currentStory.user_name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-white font-semibold text-xs md:text-sm drop-shadow-lg">{currentStory.user_name}</p>
                  <p className="text-white/70 text-[10px] md:text-xs drop-shadow">{formatRelativeTime(currentStory.created_at)}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 md:gap-2">
                {isPaused && (
                  <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <Pause className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
                  </div>
                )}

                <button
                  onClick={(e) => { stopPropagation(e); toggleMute() }}
                  className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                >
                  {isMuted ? <VolumeX className="w-3.5 h-3.5 md:w-4 md:h-4" /> : <Volume2 className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                </button>

                {isOwnStory && (
                  <div className="relative">
                    <button
                      onClick={(e) => { stopPropagation(e); setShowMenu(!showMenu) }}
                      className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
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
              </div>
            </div>

            {currentStory.caption && !isTextStory && (
              <div className="absolute bottom-28 md:bottom-32 left-2 md:left-3 right-2 md:right-3 z-20">
                <p className="text-white text-xs md:text-sm drop-shadow-lg bg-black/30 backdrop-blur-sm rounded-lg px-2.5 md:px-3 py-1.5 md:py-2">
                  {currentStory.caption}
                </p>
              </div>
            )}

            {currentStory.music_url && (
              <div className="absolute bottom-20 md:bottom-24 left-2 md:left-3 right-2 md:right-3 z-20">
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

            <div className="absolute bottom-2 md:bottom-3 left-2 md:left-3 right-2 md:right-3 z-20 pb-safe">
              {!isOwnStory ? (
                <div className="flex items-center gap-1.5 md:gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') handleSendReply() }}
                    onClick={stopPropagation}
                    placeholder="Reply to story..."
                    className="flex-1 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-3 md:px-4 py-2 md:py-2.5 text-white text-xs md:text-sm placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
                  />
                  <button
                    onClick={(e) => { stopPropagation(e); handleLike() }}
                    className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-colors ${
                      isLiked ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    <Heart className={`w-4 h-4 md:w-5 md:h-5 ${isLiked ? 'fill-current' : ''}`} />
                  </button>
                  {replyText.trim() && (
                    <button
                      onClick={(e) => { stopPropagation(e); handleSendReply() }}
                      className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-primary-600 text-white flex items-center justify-center hover:bg-primary-700 transition-colors"
                    >
                      <Send className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 text-white/70 text-xs md:text-sm">
                  <span>{currentStory.view_count || 0} views</span>
                  {replies.length > 0 && (
                    <>
                      <span>•</span>
                      <button onClick={(e) => { stopPropagation(e); setShowReplies(!showReplies) }} className="hover:text-white transition-colors">
                        {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {isOwnStory && showReplies && replies.length > 0 && (
              <div className="absolute inset-x-2 md:inset-x-3 bottom-14 md:bottom-16 z-30 bg-gray-900/95 backdrop-blur-sm rounded-xl max-h-40 md:max-h-48 overflow-y-auto" onClick={stopPropagation}>
                <div className="p-2.5 md:p-3 space-y-2.5 md:space-y-3">
                  <p className="text-white/70 text-[10px] md:text-xs font-medium">Replies</p>
                  {replies.map((reply) => (
                    <div key={reply.id} className="flex items-start gap-2">
                      <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-gray-700 flex items-center justify-center text-white text-[10px] md:text-xs">
                        {reply.author_name?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div className="flex-1">
                        <p className="text-white text-[10px] md:text-xs font-medium">{reply.author_name}</p>
                        <p className="text-white/80 text-[10px] md:text-xs">{reply.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="absolute inset-0 z-10 flex">
              <div className="w-1/3 h-full cursor-pointer" onClick={(e) => { stopPropagation(e); goToPrev() }} />
              <div className="w-1/3 h-full" />
              <div className="w-1/3 h-full cursor-pointer" onClick={(e) => { stopPropagation(e); goToNext() }} />
            </div>
          </div>
        </div>

        <div
          className="hidden md:block absolute -inset-4 rounded-[40px] opacity-30 blur-2xl -z-10"
          style={{ backgroundColor: glowColor }}
        />
      </div>

      <div className="hidden md:flex absolute bottom-6 left-1/2 -translate-x-1/2 items-center gap-2">
        {stories.map((story, idx) => (
          <button
            key={story.id}
            onClick={() => setCurrentIndex(idx)}
            className={`w-2 h-2 rounded-full transition-all ${idx === currentIndex ? 'w-6 bg-white' : 'bg-white/40 hover:bg-white/60'}`}
          />
        ))}
      </div>
    </div>
  )
}

export default StoryViewer
