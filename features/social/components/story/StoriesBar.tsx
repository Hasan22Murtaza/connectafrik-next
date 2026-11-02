'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Camera, ChevronLeft, ChevronRight, Palette, Play, Plus, Video, X } from '@/shared/icons'
import { createStory, getStoryRecommendations, getUserStories, Story } from '@/features/social/services/storiesService'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/shared/hooks/useProfile'
import { useFileUpload } from '@/shared/hooks/useFileUpload'
import { toast } from 'react-hot-toast'
import StoryViewer from './StoryViewer'
import { ALargeSmall, ListFilter, Send, Smile } from 'lucide-react'

const StoryEmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false })

const parseTextOverlay = (overlay: string | object | null | undefined) => {
  if (!overlay) return null
  try {
    return typeof overlay === 'string' ? JSON.parse(overlay) : overlay
  } catch {
    return null
  }
}

const TEXT_STORY_BACKGROUND_COLORS = [
  '#FFFFFF',
  '#F97316',
  '#2563EB',
  '#7C3AED',
  '#DB2777',
  '#059669',
  '#111827',
  '#F59E0B',
  '#F3F4F6',
] as const

const TEXT_STORY_TEXT_COLORS = ['#FFFFFF', '#111827', '#FDE68A', '#FED7AA'] as const
const MAX_TEXT_STORY_LENGTH = 250

const isTextStoryLike = (story: Story | null | undefined, textOverlay: any): boolean => {
  if (!story) return false
  if (typeof story.media_url === 'string' && story.media_url.startsWith('gradient:')) return true
  if (Boolean(story.text_overlay)) return true
  if (typeof story.background_gradient === 'string' && story.background_gradient.trim()) return true
  if (Array.isArray(story.background_gradient_colors) && story.background_gradient_colors.length >= 2) return true
  if (!story.media_url && Boolean(textOverlay?.text || story.caption || story.background_color)) return true
  return false
}

interface StoryCardProps {
  story: Story
  onClick: () => void
  hasUnseenStory?: boolean
}

const PLACEHOLDER_NAMES = new Set(['Unknown', 'Unknown User'])

const storyAuthorName = (story: { user_name?: string | null; username?: string | null }) => {
  const name = story.user_name?.trim()
  if (name && !PLACEHOLDER_NAMES.has(name)) return name
  return story.username?.trim() || name || 'Unknown'
}

const StoryCard: React.FC<StoryCardProps> = React.memo(({ story, onClick, hasUnseenStory = true }) => {
  const displayName = storyAuthorName(story)
  const displayAvatar = story.profile_picture_url || story.user_avatar || ''
  const textOverlay = parseTextOverlay(story.text_overlay)
  const isTextStory = isTextStoryLike(story, textOverlay)
  const storyText = (textOverlay?.text || story.caption || '').trim()
  const storyTextColor = story.text_color || textOverlay?.color || '#FFFFFF'
  const isVideo = story.media_type === 'video' && !isTextStory
  const videoRef = useRef<HTMLVideoElement>(null)

  const handleMouseEnter = useCallback(() => {
    if (isVideo && videoRef.current) {
      videoRef.current.play().catch(() => { })
    }
  }, [isVideo])

  const handleMouseLeave = useCallback(() => {
    if (isVideo && videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0.5
    }
  }, [isVideo])

  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 w-[90px] sm:w-[112px] group"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="relative w-[90px] sm:w-[112px] h-[170px] sm:h-[180px] rounded-[22px] overflow-hidden shadow-md hover:shadow-lg transition-shadow cursor-pointer">
        {isTextStory ? (
          <div
            className="absolute inset-0 flex items-center justify-center p-2 sm:p-3"
            style={{ backgroundColor: story.background_color || '#2563eb' }}
          >
            {storyText && (
              <p
                className="noto-color-emoji-regular text-center font-medium text-[10px] sm:text-xs line-clamp-4 sm:line-clamp-5 drop-shadow"
                style={{ color: storyTextColor }}
              >
                {storyText}
              </p>
            )}
          </div>
        ) : isVideo && story.media_url ? (
          <video
            ref={videoRef}
            src={story.media_url}
            muted
            loop
            playsInline
            preload="metadata"
            onLoadedData={(e) => {
              const video = e.currentTarget
              video.currentTime = 0.5
            }}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : story.media_url ? (
          <img
            src={story.media_url}
            alt={displayName}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-400 to-gray-600" />
        )}

        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />

        {story.media_type === 'video' && !isTextStory && (
          <div className="absolute top-1.5 sm:top-2 right-1.5 sm:right-2 z-10">
            <div className="w-5 h-5 sm:w-6 sm:h-6 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-sm">
              <Play className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white fill-white" />
            </div>
          </div>
        )}

        <div className="absolute top-2 sm:top-3 left-2 sm:left-3 z-10">
          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full p-[2px] sm:p-[2.5px] ${hasUnseenStory ? 'bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600' : 'bg-gray-400'}`}>
            <div className="w-full h-full rounded-full bg-surface p-[1.5px] sm:p-[2px]">
              {displayAvatar ? (
                <img src={displayAvatar} alt={displayName} className="w-full h-full rounded-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <span className="text-white font-bold text-xs sm:text-sm">{displayName.charAt(0).toUpperCase()}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {story.music_url && (
          <div className="absolute top-2 sm:top-3 right-2 sm:right-3 z-10">
            <div className="w-5 h-5 sm:w-6 sm:h-6 bg-purple-500/80 rounded-full flex items-center justify-center backdrop-blur-sm animate-pulse">
              <span className="text-white text-[10px] sm:text-xs">♪</span>
            </div>
          </div>
        )}

        <div className="absolute bottom-2 sm:bottom-3 left-1.5 sm:left-2 right-1.5 sm:right-2 z-10">
          <p className="text-white text-[10px] sm:text-xs font-semibold truncate drop-shadow-lg">{displayName}</p>
        </div>
      </div>
    </button>
  )
})

StoryCard.displayName = 'StoryCard'

interface CreateStoryCardProps {
  userStories: Story[]
  profile: any
  user: any
  onCreate: () => void
  onView: () => void
  onMediaSelect: (file: File, mediaType: 'image' | 'video') => void
  onTextCreate: () => void
}

const CreateStoryCard: React.FC<CreateStoryCardProps> = React.memo(({ userStories, profile, user, onView, onCreate, onMediaSelect, onTextCreate }) => {
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const hasStories = userStories.length > 0
  const latestStory = userStories[0]
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url
  const userName = profile?.full_name || user?.user_metadata?.full_name || 'You'
  const latestStoryTextOverlay = parseTextOverlay(latestStory?.text_overlay)
  const isTextStory = isTextStoryLike(latestStory, latestStoryTextOverlay)
  const latestStoryText = (latestStoryTextOverlay?.text || latestStory?.caption || '').trim()
  const latestStoryTextColor = latestStory?.text_color || latestStoryTextOverlay?.color || '#FFFFFF'
  const isVideo = latestStory?.media_type === 'video' && !isTextStory
  const videoRef = useRef<HTMLVideoElement>(null)

  const handleMouseEnter = useCallback(() => {
    if (isVideo && videoRef.current) {
      videoRef.current.play().catch(() => { })
    }
  }, [isVideo])

  const handleMouseLeave = useCallback(() => {
    if (isVideo && videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0.5
    }
  }, [isVideo])

  if (hasStories) {
    return (
      <div
        className="flex-shrink-0 w-[90px] sm:w-[112px]"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="relative w-[90px] sm:w-[112px] h-[160px] sm:h-[180px] rounded-[22px] overflow-hidden  hover:shadow-lg transition-shadow">
          <button onClick={onView} className="absolute inset-0 cursor-pointer">
            {isTextStory ? (
              <div
                className="relative flex h-full w-full items-center justify-center p-2"
                style={{ backgroundColor: latestStory.background_color || '#2563eb' }}
              >
                {latestStoryText && (
                  <p
                    className="noto-color-emoji-regular line-clamp-5 text-center text-[10px] font-medium drop-shadow sm:text-xs"
                    style={{ color: latestStoryTextColor }}
                  >
                    {latestStoryText}
                  </p>
                )}
              </div>
            ) : isVideo && latestStory.media_url ? (
              <video
                ref={videoRef}
                src={latestStory.media_url}
                muted
                loop
                playsInline
                preload="metadata"
                onLoadedData={(e) => {
                  const video = e.currentTarget
                  video.currentTime = 0.5
                }}
                className="w-full h-full object-cover"
              />
            ) : latestStory.media_url ? (
              <img src={latestStory.media_url} alt="Your story" className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600" />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />
          </button>

          <div className="absolute top-2 sm:top-3 left-2 sm:left-3 z-10 pointer-events-none">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full p-[2px] sm:p-[2.5px] bg-primary-500">
              <div className="w-full h-full rounded-full bg-surface p-[1.5px] sm:p-[2px]">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Your profile" className="w-full h-full rounded-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full rounded-full bg-primary-500 flex items-center justify-center">
                    <span className="text-white font-bold text-xs sm:text-sm">{userName.charAt(0).toUpperCase()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onCreate}
            className="absolute top-1.5 sm:top-2 right-1.5 sm:right-2 z-20 w-6 h-6 sm:w-7 sm:h-7 bg-primary-500 hover:bg-primary-600 rounded-full flex items-center justify-center border-2 border-white shadow-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
          </button>

          <div className="absolute bottom-2 sm:bottom-3 left-1.5 sm:left-2 right-1.5 sm:right-2 z-10 pointer-events-none">
            <p className="text-white text-[10px] sm:text-xs font-semibold truncate drop-shadow-lg">Your story</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-shrink-0 w-[116px] sm:w-[128px]">
      <div className="relative h-[170px] sm:h-[180px] rounded-[22px] overflow-hidden bg-surface border border-[#eadfd7] shadow-sm">
        <button type="button" onClick={hasStories ? onView : undefined} className="absolute inset-x-0 top-0 h-[136px] sm:h-[148px] text-left">
          <div className="absolute inset-x-0 top-0 h-[96px] sm:h-[108px]" />
          <div className="absolute top-3 sm:top-4 left-1/2 -translate-x-1/2 w-[54px] h-[54px] sm:w-[60px] sm:h-[60px] rounded-full p-[3px] bg-white shadow-sm">
            {avatarUrl ? (
              <img src={avatarUrl} alt={userName} className="w-full h-full rounded-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full rounded-full bg-gradient-to-br from-primary-500 to-orange-400 flex items-center justify-center">
                <span className="text-white text-lg font-bold">{userName.charAt(0).toUpperCase()}</span>
              </div>
            )}
          </div>
          <div className="absolute top-[48px]  right-7 w-6 h-6 rounded-full bg-[#ff6900] border-2 border-white flex items-center justify-center shadow-sm">
            <Plus className="w-3.5 h-3.5 text-white" />
          </div>
          <p className="absolute top-[85px]  inset-x-0 text-center text-[12px] sm:text-[13px] font-semibold text-content">
            {hasStories ? 'Your story' : '+ Add Story'}
          </p>
        </button>

        <div className="absolute bottom-2.5 left-2.5 right-2.5 h-9 rounded-full bg-[#f0f0fb] flex items-center justify-around">
          <button type="button" aria-label="Add photo story" title="Add photo story" onClick={() => imageInputRef.current?.click()} className="p-1.5 text-content-secondary hover:text-primary-600 transition-colors">
            <Camera className="w-[17px] h-[17px]" />
          </button>
          <button type="button" aria-label="Add video story" title="Add video story" onClick={() => videoInputRef.current?.click()} className="p-1.5 text-content-secondary hover:text-primary-600 transition-colors">
            <Video className="w-[17px] h-[17px]" />
          </button>
          <button type="button" aria-label="Write text story" title="Write text story" onClick={onTextCreate} className="p-1.5 text-content-secondary hover:text-primary-600 transition-colors">
            <ListFilter className="w-[17px] h-[17px]" />
          </button>
        </div>

        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onMediaSelect(file, 'image')
          event.target.value = ''
        }} />
        <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onMediaSelect(file, 'video')
          event.target.value = ''
        }} />
      </div>
    </div>
  )
})
CreateStoryCard.displayName = 'CreateStoryCard'
const LoadingSkeleton: React.FC = React.memo(() => (
  <div className="bg-surface rounded-xl ">
    <div className="flex gap-1.5 sm:gap-2 overflow-hidden">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex-shrink-0 w-[90px] sm:w-[112px] h-[160px] sm:h-[180px] bg-surface-tertiary rounded-xl animate-shimmer" />
      ))}
    </div>
  </div>
))

LoadingSkeleton.displayName = 'LoadingSkeleton'

const StoriesBar: React.FC = () => {
  const router = useRouter()
  const { user } = useAuth()
  const { profile } = useProfile()
  const { uploadFile } = useFileUpload()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const storyEditorRef = useRef<HTMLDivElement>(null)
  const hasLoadedOnce = useRef(false)

  const [stories, setStories] = useState<Story[]>([])
  const [userOwnStories, setUserOwnStories] = useState<Story[]>([])
  const [storiesByUser, setStoriesByUser] = useState<Record<string, Story[]>>({})
  const [loading, setLoading] = useState(true)
  const [isViewerOpen, setIsViewerOpen] = useState(false)
  const [selectedStoryIndex, setSelectedStoryIndex] = useState(0)
  const [viewerStories, setViewerStories] = useState<Story[]>([])
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(false)
  const [isTextDialogOpen, setIsTextDialogOpen] = useState(false)
  const [textStory, setTextStory] = useState('')
  const [textStoryBackgroundColor, setTextStoryBackgroundColor] = useState('#FFFFFF')
  const [textStoryTextColor, setTextStoryTextColor] = useState('#111827')
  const [activeTextTool, setActiveTextTool] = useState<'text' | 'background' | 'textColor' | 'emoji' | ''>('text')
  const [isCreatingStory, setIsCreatingStory] = useState(false)

  const checkScrollPosition = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return
    setShowLeftArrow(container.scrollLeft > 20)
    setShowRightArrow(container.scrollLeft < container.scrollWidth - container.clientWidth - 20)
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
  }, [checkScrollPosition, stories])

  const scroll = useCallback((direction: 'left' | 'right') => {
    scrollContainerRef.current?.scrollBy({ left: direction === 'left' ? -240 : 240, behavior: 'smooth' })
  }, [])

  const normalizeStory = useCallback((story: any): Story => ({
    ...story,
    id: story?.id || story?.story_id || '',
    user_id: story?.user_id || '',
    user_name: story?.user_name || 'Unknown User',
    user_avatar: story?.profile_picture_url || story?.user_avatar || '',
    username: story?.username || '',
    profile_picture_url: story?.profile_picture_url || story?.user_avatar || '',
    background_color: story?.background_color || '#2563eb',
    background_gradient: story?.background_gradient || null,
    background_gradient_colors: Array.isArray(story?.background_gradient_colors)
      ? story.background_gradient_colors
      : null,
    view_count: story?.view_count || 0,
    has_viewed: Boolean(story?.has_viewed),
  }), [])

  // Process raw data into state (reusable helper)
  const processStoryData = useCallback((storyRecommendations: Story[], ownStories: Story[]) => {
    const normalizedRecommendations = storyRecommendations
      .map(normalizeStory)
      .filter((story) => Boolean(story.id && story.user_id))

    const groupedStories = normalizedRecommendations.reduce<Record<string, Story[]>>((acc, story) => {
      if (!acc[story.user_id]) acc[story.user_id] = []
      acc[story.user_id].push(story)
      return acc
    }, {})

    Object.keys(groupedStories).forEach((userId) => {
      groupedStories[userId].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    })

    const latestStoryByUser = new Map<string, Story>()
    normalizedRecommendations.forEach(story => {
      const existing = latestStoryByUser.get(story.user_id)
      if (!existing || new Date(story.created_at) > new Date(existing.created_at)) {
        latestStoryByUser.set(story.user_id, story)
      }
    })

    setStoriesByUser(groupedStories)
    setStories(Array.from(latestStoryByUser.values()))
    setUserOwnStories(ownStories.map((story) => normalizeStory({
      ...story,
      user_name: story.user_name || profile?.full_name || user?.user_metadata?.full_name || 'You',
      user_avatar: story.user_avatar || profile?.avatar_url || user?.user_metadata?.avatar_url || '',
      has_viewed: true,
    })))
  }, [normalizeStory, profile?.full_name, profile?.avatar_url, user?.user_metadata?.full_name, user?.user_metadata?.avatar_url])

  // Initial load — shows skeleton only the first time
  const loadStories = useCallback(async () => {
    if (!user?.id) return

    try {
      if (!hasLoadedOnce.current) setLoading(true)

      const [storyRecommendations, ownStories] = await Promise.all([
        getStoryRecommendations(user.id),
        getUserStories(user.id)
      ])

      processStoryData(storyRecommendations, ownStories)
      hasLoadedOnce.current = true
    } catch (error) {
      console.error('Error loading stories:', error)
    } finally {
      setLoading(false)
    }
  }, [user?.id, processStoryData])

  // Silent background refresh — no skeleton, no flash
  const refreshStories = useCallback(async () => {
    if (!user?.id) return
    try {
      const [storyRecommendations, ownStories] = await Promise.all([
        getStoryRecommendations(user.id),
        getUserStories(user.id)
      ])
      processStoryData(storyRecommendations, ownStories)
    } catch (error) {
      console.error('Error refreshing stories:', error)
    }
  }, [user?.id, processStoryData])

  useEffect(() => {
    loadStories()
  }, [loadStories])

  // Listen for new story created from the create page — push optimistically
  useEffect(() => {
    const handleStoryCreated = (e: CustomEvent<Story>) => {
      const newStory = e.detail
      if (!newStory) return

      // Prepend to user's own stories immediately (no DB call)
      setUserOwnStories(prev => {
        const exists = prev.some(s => s.id === newStory.id)
        if (exists) return prev
        return [{
          ...newStory,
          user_name: newStory.user_name || profile?.full_name || user?.user_metadata?.full_name || 'You',
          user_avatar: newStory.user_avatar || profile?.avatar_url || user?.user_metadata?.avatar_url || '',
          has_viewed: true
        }, ...prev]
      })

      // Scroll the bar to the start to show the new story
      setTimeout(() => {
        scrollContainerRef.current?.scrollTo({ left: 0, behavior: 'smooth' })
      }, 100)

      // Sync with DB in background after a short delay
      setTimeout(() => refreshStories(), 2000)
    }

    window.addEventListener('story-created', handleStoryCreated as EventListener)
    return () => window.removeEventListener('story-created', handleStoryCreated as EventListener)
  }, [profile?.full_name, profile?.avatar_url, user?.user_metadata?.full_name, user?.user_metadata?.avatar_url, refreshStories])

  const handleCreateStory = useCallback(() => router.push('/stories/create'), [router])

  const handleMediaSelect = useCallback(async (file: File, mediaType: 'image' | 'video') => {
    if (!user) return
    setIsCreatingStory(true)
    try {
      const result = await uploadFile(file, {
        bucket: mediaType === 'image' ? 'post-images' : 'post-videos',
        compress: mediaType === 'image',
      })
      if (!result.url) throw new Error(result.error || 'Unable to upload this file')
      const createdStory = await createStory({ media_url: result.url, media_type: mediaType })
      window.dispatchEvent(new CustomEvent('story-created', { detail: createdStory }))
      toast.success('Story created successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create story')
    } finally {
      setIsCreatingStory(false)
    }
  }, [uploadFile, user])

  const handleTextStoryCreate = useCallback(async () => {
    const text = textStory.trim()
    if (!text || isCreatingStory) return
    setIsCreatingStory(true)
    try {
      const createdStory = await createStory({
        caption: text,
        text: text,
        media_type: 'text',
        background_color: textStoryBackgroundColor,
        text_color: textStoryTextColor,
        text_overlay: JSON.stringify({
          text,
          fontSize: 24,
          color: textStoryTextColor,
          backgroundColor: 'transparent',
          align: 'center',
          x: 50,
          y: 50,
        }),
      })
      window.dispatchEvent(new CustomEvent('story-created', { detail: createdStory }))
      setTextStory('')
      setIsTextDialogOpen(false)
      toast.success('Story created successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create story')
    } finally {
      setIsCreatingStory(false)
    }
  }, [isCreatingStory, textStory, textStoryBackgroundColor, textStoryTextColor])

  const insertStoryEmoji = useCallback((emoji: string) => {
    setTextStory((current) => {
      const nextText = `${current}${emoji}`.slice(0, MAX_TEXT_STORY_LENGTH)
      if (storyEditorRef.current) {
        storyEditorRef.current.textContent = nextText
        storyEditorRef.current.focus()
        const selection = window.getSelection()
        const range = document.createRange()
        range.selectNodeContents(storyEditorRef.current)
        range.collapse(false)
        selection?.removeAllRanges()
        selection?.addRange(range)
      }
      return nextText
    })
    setActiveTextTool('text')
  }, [])

  useEffect(() => {
    if (isTextDialogOpen && storyEditorRef.current && storyEditorRef.current.textContent !== textStory) {
      storyEditorRef.current.textContent = textStory
    }
  }, [isTextDialogOpen, textStory])

  const handleStoryBoardInput = useCallback((event: React.FormEvent<HTMLDivElement>) => {
    const nextText = event.currentTarget.textContent || ''
    if (nextText.length > MAX_TEXT_STORY_LENGTH) {
      event.currentTarget.textContent = nextText.slice(0, MAX_TEXT_STORY_LENGTH)
    }
    setTextStory(nextText.slice(0, MAX_TEXT_STORY_LENGTH))
  }, [])

  const handleViewStory = useCallback((storyIndex: number) => {
    const selectedStory = stories[storyIndex]
    if (!selectedStory) return

    const userStories = (storiesByUser[selectedStory.user_id] || [selectedStory]).filter((story) => Boolean(story.id))
    if (userStories.length === 0) return
    setViewerStories(userStories)
    setSelectedStoryIndex(0)
    setIsViewerOpen(true)
  }, [stories, storiesByUser])

  const handleViewOwnStories = useCallback(() => {
    if (!user || userOwnStories.length === 0) return
    setViewerStories(userOwnStories)
    setSelectedStoryIndex(0)
    setIsViewerOpen(true)
  }, [user, userOwnStories])

  // On viewer close: mark viewed stories locally, then silent refresh in background
  const handleViewerClose = useCallback(() => {
    setIsViewerOpen(false)

    // Mark the viewed stories as seen locally (instant, no DB call)
    if (viewerStories.length > 0) {
      const viewedIds = new Set(viewerStories.map(s => s.id))
      setStories(prev => prev.map(s =>
        viewedIds.has(s.id) ? { ...s, has_viewed: true } : s
      ))
    }

    // Silent background sync (no skeleton flash)
    refreshStories()
  }, [viewerStories, refreshStories])

  const storyCards = useMemo(() =>
    stories.map((story, index) => (
      <div key={story.id} className="animate-fade-in-card">
        <StoryCard
          story={story}
          onClick={() => handleViewStory(index)}
          hasUnseenStory={!story.has_viewed}
        />
      </div>
    )), [stories, handleViewStory]
  )

  if (loading) return <LoadingSkeleton />

  return (
    <>
      <div className="relative">
        {showLeftArrow && (
          <button
            onClick={() => scroll('left')}
            className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-surface rounded-full shadow-lg items-center justify-center hover:bg-surface-secondary transition-colors border border-border"
          >
            <ChevronLeft className="w-6 h-6 text-content-secondary" />
          </button>
        )}

        {showRightArrow && (
          <button
            onClick={() => scroll('right')}
            className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-surface rounded-full shadow-lg items-center justify-center hover:bg-surface-secondary transition-colors border border-border"
          >
            <ChevronRight className="w-6 h-6 text-content-secondary" />
          </button>
        )}

        <div ref={scrollContainerRef} className="flex gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide scroll-smooth -mx-1 px-1">
          <CreateStoryCard
            userStories={userOwnStories}
            profile={profile}
            user={user}
            onView={handleViewOwnStories}
            onCreate={handleCreateStory}
            onMediaSelect={handleMediaSelect}
            onTextCreate={() => setIsTextDialogOpen(true)}
          />
          {storyCards}
          {stories.length === 0 && (
            <div className="flex-shrink-0 w-[90px] sm:w-[112px] h-[160px] sm:h-[180px] bg-surface-secondary rounded-xl flex items-center justify-center border border-dashed border-border">
              <p className="text-content-tertiary text-[10px] sm:text-xs text-center px-2">No stories<br />to show</p>
            </div>
          )}
        </div>
      </div>

      <StoryViewer
        isOpen={isViewerOpen}
        onClose={handleViewerClose}
        stories={viewerStories}
        initialStoryIndex={selectedStoryIndex}
      />
      {isTextDialogOpen && (
        <div
          className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/60 p-3 backdrop-blur-[1px] sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="text-story-dialog-title"
        >
          <div
            className="flex max-h-[95dvh] w-full max-w-[520px] flex-col overflow-hidden rounded-[28px]  bg-white shadow-[0_24px_70px_rgba(44,62,88,0.2)]"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#edf0f4] px-4 py-3.5 sm:px-5">
              <div>
                <h2
                  id="text-story-dialog-title"
                  className="text-sm font-semibold text-[#364152]"
                >
                  Create status
                </h2>
                <p className="mt-0.5 text-[9px] text-[#8b95a5]">
                  Share an update with your contacts • 24h duration
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsTextDialogOpen(false)}
                className="rounded-full p-1.5 text-[#7d8795] transition hover:bg-[#f1f3f6] hover:text-[#364152]"
                aria-label="Close dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Preview */}
            <div className="flex justify-center overflow-y-auto ">
              <div
                className="relative flex aspect-[9/14] w-full  items-center justify-center overflow-hidden  p-8 shadow-[0_10px_24px_rgba(37,53,76,0.16)] transition-colors"
                style={{
                  backgroundColor: textStoryBackgroundColor,
                  color: textStoryTextColor,
                }}
              >
                {/* Top Right Tools */}
                <div className="absolute right-3 top-3 z-20 flex items-start gap-1.5">
                  {/* Text Tool */}
                  <button
                    type="button"
                    onClick={() => setActiveTextTool('text')}
                    aria-label="Edit status text"
                    aria-pressed={activeTextTool === 'text'}
                    className={`flex h-7 w-7 items-center justify-center rounded-full shadow-md backdrop-blur-md transition
                ${activeTextTool === 'text'
                        ? 'bg-[#F97316] text-white'
                        : 'bg-black/20 text-white hover:bg-black/35'
                      }`}
                  >
                    <span className="text-sm font-bold leading-none" aria-hidden="true">T</span>
                  </button>

                  {/* Background Tool */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveTextTool(
                          activeTextTool === 'background' ? '' : 'background'
                        )
                      }
                      aria-label="Background color"
                      aria-expanded={activeTextTool === 'background'}
                      className={`flex h-7 w-7 items-center justify-center rounded-full shadow-md backdrop-blur-md transition
                  ${activeTextTool === 'background'
                          ? 'bg-[#F97316] text-white'
                          : 'bg-black/50 text-white hover:bg-black/70'
                        }`}
                    >
                      <Palette className="h-3.5 w-3.5" />
                    </button>

                    {activeTextTool === 'background' && (
                      <div className="absolute right-0 top-9 z-30 w-[190px] rounded-xl border border-[#e5e7eb] bg-white p-3 shadow-xl">
                        <p className="mb-3 text-xs font-semibold text-[#364152]">
                          Background color
                        </p>

                        <div className="grid grid-cols-5 gap-2">
                          {TEXT_STORY_BACKGROUND_COLORS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              aria-label={`Use ${color} background`}
                              aria-pressed={textStoryBackgroundColor === color}
                              onClick={() => setTextStoryBackgroundColor(color)}
                              className={`h-7 w-7 rounded-full border-2 transition hover:scale-110
                          ${textStoryBackgroundColor === color
                                  ? 'border-white ring-2 ring-[#F97316]'
                                  : 'border-[#d6dbe3]'
                                }`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Text Color Tool */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveTextTool(
                          activeTextTool === 'textColor' ? '' : 'textColor'
                        )
                      }
                      aria-label="Text color"
                      aria-expanded={activeTextTool === 'textColor'}
                      className={`flex h-7 w-7 items-center justify-center rounded-full shadow-md backdrop-blur-md transition
                  ${activeTextTool === 'textColor'
                          ? 'bg-[#F97316] text-white'
                          : 'bg-black/50 text-white hover:bg-black/70'
                        }`}
                    >
                      <ALargeSmall className="h-3.5 w-3.5" />
                    </button>

                    {activeTextTool === 'textColor' && (
                      <div className="absolute right-0 top-9 z-30 w-[190px] rounded-xl border border-[#e5e7eb] bg-white p-3 shadow-xl">
                        <p className="mb-3 text-xs font-semibold text-[#364152]">
                          Text color
                        </p>

                        <div className="grid grid-cols-5 gap-2">
                          {TEXT_STORY_TEXT_COLORS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              aria-label={`Use ${color} text`}
                              aria-pressed={textStoryTextColor === color}
                              onClick={() => setTextStoryTextColor(color)}
                              className={`h-7 w-7 rounded-full border-2 transition hover:scale-110
                          ${textStoryTextColor === color
                                  ? 'border-white ring-2 ring-[#F97316]'
                                  : 'border-[#d6dbe3]'
                                }`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Emoji Tool */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveTextTool(
                          activeTextTool === 'emoji' ? '' : 'emoji'
                        )
                      }
                      aria-label="Select emoji"
                      aria-expanded={activeTextTool === 'emoji'}
                      className={`flex h-7 w-7 items-center justify-center rounded-full shadow-md backdrop-blur-md transition
                  ${activeTextTool === 'emoji'
                          ? 'bg-[#F97316] text-white'
                          : 'bg-black/50 text-white hover:bg-black/70'
                        }`}
                    >
                      <Smile className="h-3.5 w-3.5" />
                    </button>

                    {activeTextTool === 'emoji' && (
                      <div className="absolute right-0 top-9 z-30 w-[min(300px,calc(100vw-40px))] overflow-hidden rounded-xl border border-[#e5e7eb] bg-white p-2 shadow-xl">
                        <StoryEmojiPicker
                          onEmojiClick={(emojiData) =>
                            insertStoryEmoji(emojiData.emoji)
                          }
                          width="100%"
                          height={300}
                          searchDisabled
                          skinTonesDisabled
                          previewConfig={{ showPreview: false }}
                          lazyLoadEmojis
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Editable Story Text */}
                <div
                  ref={storyEditorRef}
                  contentEditable
                  suppressContentEditableWarning
                  role="textbox"
                  aria-label="Write your status"
                  aria-multiline="true"
                  spellCheck
                  onInput={handleStoryBoardInput}
                  data-placeholder="Type a status..."
                  className="noto-color-emoji-regular max-h-full w-full overflow-y-auto break-words whitespace-pre-wrap text-center text-2xl font-semibold leading-relaxed outline-none empty:before:content-[attr(data-placeholder)] empty:before:opacity-40 sm:text-3xl"
                />

                {/* Character Count */}
                <div className="absolute bottom-3 left-4 rounded-full bg-black/10 px-2 py-0.5 text-[9px] opacity-70">
                  {textStory.length}/{MAX_TEXT_STORY_LENGTH}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 border-t border-[#edf0f4] px-4 py-3 sm:px-5">
              

              <div className="flex shrink-0 items-center justify-end w-full gap-2">
                <button
                  type="button"
                  onClick={() => setIsTextDialogOpen(false)}
                  className="rounded-full px-3 py-2 text-xs font-medium text-[#566171] transition hover:bg-[#f1f3f6] hover:text-[#364152]"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={!textStory.trim() || isCreatingStory}
                  onClick={handleTextStoryCreate}
                  className="flex items-center gap-1.5 rounded-full bg-[#F97316] px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:bg-[#EA580C] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                  {isCreatingStory ? 'Posting...' : 'Post'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default StoriesBar
