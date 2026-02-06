'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ChevronLeft, ChevronRight, Play } from 'lucide-react'
import { getStoryRecommendations, getUserStories, getStoriesByUser, Story } from '@/features/social/services/storiesService'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/shared/hooks/useProfile'
import StoryViewer from './StoryViewer'

const parseTextOverlay = (overlay: string | object | null | undefined) => {
  if (!overlay) return null
  return typeof overlay === 'string' ? JSON.parse(overlay) : overlay
}

interface StoryCardProps {
  story: Story
  onClick: () => void
  hasUnseenStory?: boolean
}

const StoryCard: React.FC<StoryCardProps> = React.memo(({ story, onClick, hasUnseenStory = true }) => {
  const displayName = story.username || story.user_name || 'Unknown'
  const displayAvatar = story.profile_picture_url || story.user_avatar || ''
  const isTextStory = story.media_url?.startsWith('gradient:') || story.text_overlay
  const textOverlay = parseTextOverlay(story.text_overlay)

  return (
    <button onClick={onClick} className="flex-shrink-0 w-[90px] sm:w-[112px] group">
      <div className="relative w-[90px] sm:w-[112px] h-[160px] sm:h-[200px] rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow cursor-pointer">
        {isTextStory ? (
          <div
            className="absolute inset-0 flex items-center justify-center p-2 sm:p-3"
            style={{ backgroundColor: story.background_color || '#2563eb' }}
          >
            {textOverlay?.text && (
              <p className="text-white text-center font-medium text-[10px] sm:text-xs line-clamp-4 sm:line-clamp-5 drop-shadow">
                {textOverlay.text}
              </p>
            )}
          </div>
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
            <div className="w-full h-full rounded-full bg-white p-[1.5px] sm:p-[2px]">
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
  onView: () => void
  onCreate: () => void
}

const CreateStoryCard: React.FC<CreateStoryCardProps> = React.memo(({ userStories, profile, user, onView, onCreate }) => {
  const hasStories = userStories.length > 0
  const latestStory = userStories[0]
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url
  const userName = profile?.full_name || user?.user_metadata?.full_name || 'You'
  const isTextStory = latestStory?.media_url?.startsWith('gradient:') || latestStory?.text_overlay

  if (hasStories) {
    return (
      <div className="flex-shrink-0 w-[90px] sm:w-[112px]">
        <div className="relative w-[90px] sm:w-[112px] h-[160px] sm:h-[200px] rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow">
          <button onClick={onView} className="absolute inset-0 cursor-pointer">
            {isTextStory ? (
              <div className="w-full h-full" style={{ backgroundColor: latestStory.background_color || '#2563eb' }} />
            ) : latestStory.media_url ? (
              <img src={latestStory.media_url} alt="Your story" className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600" />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />
          </button>

          <div className="absolute top-2 sm:top-3 left-2 sm:left-3 z-10 pointer-events-none">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full p-[2px] sm:p-[2.5px] bg-primary-500">
              <div className="w-full h-full rounded-full bg-white p-[1.5px] sm:p-[2px]">
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
            onClick={(e) => { e.stopPropagation(); onCreate() }}
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
    <button onClick={onCreate} className="flex-shrink-0 w-[90px] sm:w-[112px]">
      <div className="relative w-[90px] sm:w-[112px] h-[160px] sm:h-[200px] rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow cursor-pointer bg-white border border-gray-200">
        <div className="absolute top-0 left-0 right-0 h-[110px] sm:h-[140px]">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Your profile" className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
              <span className="text-gray-400 text-3xl sm:text-4xl font-bold">{userName.charAt(0).toUpperCase()}</span>
            </div>
          )}
        </div>

        <div className="absolute top-[92px] sm:top-[120px] left-1/2 -translate-x-1/2 z-10">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-[3px] sm:border-4 border-white bg-white shadow-lg">
            <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-primary-500" />
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-[50px] sm:h-[60px] bg-white flex items-end justify-center pb-2 sm:pb-3">
          <p className="text-gray-900 text-[10px] sm:text-xs font-semibold text-center">Create<br />story</p>
        </div>
      </div>
    </button>
  )
})

CreateStoryCard.displayName = 'CreateStoryCard'

const LoadingSkeleton: React.FC = React.memo(() => (
  <div className="bg-white rounded-xl p-3 sm:p-4">
    <div className="flex gap-1.5 sm:gap-2 overflow-hidden">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex-shrink-0 w-[90px] sm:w-[112px] h-[160px] sm:h-[200px] bg-gray-200 rounded-xl animate-shimmer" />
      ))}
    </div>
  </div>
))

LoadingSkeleton.displayName = 'LoadingSkeleton'

const StoriesBar: React.FC = () => {
  const router = useRouter()
  const { user } = useAuth()
  const { profile } = useProfile()
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const [stories, setStories] = useState<Story[]>([])
  const [userOwnStories, setUserOwnStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)
  const [isViewerOpen, setIsViewerOpen] = useState(false)
  const [selectedStoryIndex, setSelectedStoryIndex] = useState(0)
  const [viewerStories, setViewerStories] = useState<Story[]>([])
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(false)

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

  const loadStories = useCallback(async () => {
    if (!user?.id) return

    try {
      setLoading(true)
      const [storyRecommendations, ownStories] = await Promise.all([
        getStoryRecommendations(user.id),
        getUserStories(user.id)
      ])

      const storiesByUser = new Map<string, Story>()
      storyRecommendations.forEach(story => {
        const existing = storiesByUser.get(story.user_id)
        if (!existing || new Date(story.created_at) > new Date(existing.created_at)) {
          storiesByUser.set(story.user_id, {
            ...story,
            user_name: story.username || story.user_name || 'Unknown User',
            user_avatar: story.profile_picture_url || story.user_avatar || '',
            username: story.username,
            profile_picture_url: story.profile_picture_url
          })
        }
      })

      setStories(Array.from(storiesByUser.values()))
      setUserOwnStories(ownStories.map(story => ({
        ...story,
        user_name: story.user_name || profile?.full_name || user.user_metadata?.full_name || 'You',
        user_avatar: story.user_avatar || profile?.avatar_url || user.user_metadata?.avatar_url || ''
      })))
    } catch (error) {
      console.error('Error loading stories:', error)
    } finally {
      setLoading(false)
    }
  }, [user?.id, profile?.full_name, profile?.avatar_url, user?.user_metadata?.full_name, user?.user_metadata?.avatar_url])

  useEffect(() => {
    loadStories()
  }, [loadStories])

  const handleCreateStory = useCallback(() => router.push('/stories/create'), [router])

  const handleViewStory = useCallback(async (storyIndex: number) => {
    const selectedStory = stories[storyIndex]
    if (!selectedStory || !user?.id) return

    try {
      const userStories = await getStoriesByUser(selectedStory.user_id, user.id)
      setViewerStories(userStories)
    } catch (error) {
      console.error('Error loading user stories:', error)
      setViewerStories([selectedStory])
    }
    setSelectedStoryIndex(0)
    setIsViewerOpen(true)
  }, [stories, user?.id])

  const handleViewOwnStories = useCallback(() => {
    if (!user || userOwnStories.length === 0) return
    setViewerStories(userOwnStories)
    setSelectedStoryIndex(0)
    setIsViewerOpen(true)
  }, [user, userOwnStories])

  const handleViewerClose = useCallback(() => {
    setIsViewerOpen(false)
    loadStories()
  }, [loadStories])

  const storyCards = useMemo(() =>
    stories.map((story, index) => (
      <StoryCard
        key={story.id}
        story={story}
        onClick={() => handleViewStory(index)}
        hasUnseenStory={!story.has_viewed}
      />
    )), [stories, handleViewStory]
  )

  if (loading) return <LoadingSkeleton />

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 relative">
        {showLeftArrow && (
          <button
            onClick={() => scroll('left')}
            className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white rounded-full shadow-lg items-center justify-center hover:bg-gray-50 transition-colors border border-gray-200"
          >
            <ChevronLeft className="w-6 h-6 text-gray-600" />
          </button>
        )}

        {showRightArrow && (
          <button
            onClick={() => scroll('right')}
            className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white rounded-full shadow-lg items-center justify-center hover:bg-gray-50 transition-colors border border-gray-200"
          >
            <ChevronRight className="w-6 h-6 text-gray-600" />
          </button>
        )}

        <div ref={scrollContainerRef} className="flex gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide scroll-smooth -mx-1 px-1">
          <CreateStoryCard
            userStories={userOwnStories}
            profile={profile}
            user={user}
            onView={handleViewOwnStories}
            onCreate={handleCreateStory}
          />
          {storyCards}
          {stories.length === 0 && (
            <div className="flex-shrink-0 w-[90px] sm:w-[112px] h-[160px] sm:h-[200px] bg-gray-50 rounded-xl flex items-center justify-center border border-dashed border-gray-300">
              <p className="text-gray-400 text-[10px] sm:text-xs text-center px-2">No stories<br />to show</p>
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
    </>
  )
}

export default StoriesBar
