import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Play } from 'lucide-react'
import { getStoryRecommendations, getUserStories, getStoriesByUser, Story } from '@/features/social/services/storiesService'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/shared/hooks/useProfile'
import CreateStoryModal from '@/features/social/components/CreateStoryModal'
import StoriesViewer from '@/features/social/components/StoriesViewer'

interface StoryCardProps {
  story: Story
  onClick: () => void
}

const StoryCard: React.FC<StoryCardProps> = React.memo(({ story, onClick }) => {
  const displayName = story.username || story.user_name || 'Unknown User'
  const displayAvatar = story.profile_picture_url || story.user_avatar || ''
  
  return (
    <div className="shrink-0">
      <button
        onClick={onClick}
        className="relative sm:w-40 sm:h-64 w-34 h-55 rounded-2xl overflow-hidden group cursor-pointer transition-transform hover:scale-105"
      >
        <div className="absolute inset-0">
          {story.media_url ? (
            <img
              src={story.media_url}
              alt={displayName}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-400 to-gray-600"></div>
          )}
          <div className="absolute inset-0 bg-black/20"></div>
        </div>
        
        <div className="absolute top-3 left-3 z-10">
          <div className="w-12 h-12 rounded-full overflow-hidden border-3 border-white shadow-md">
            {displayAvatar ? (
              <img
                src={displayAvatar}
                alt={displayName}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                <span className="text-white font-bold text-lg">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </div>

        {story.media_type === 'video' && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-5">
            <div className="w-12 h-12 bg-black/60 rounded-full flex items-center justify-center backdrop-blur-sm">
              <Play className="w-6 h-6 text-white fill-white" />
            </div>
          </div>
        )}

        {story.music_url && (
          <div className="absolute top-3 right-3 z-10">
            <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center shadow-md">
              <span className="text-white text-sm">♪</span>
            </div>
          </div>
        )}

        <div className="absolute bottom-3 left-3 right-3 z-10 pointer-events-none">
          <span className="text-white text-sm font-bold drop-shadow-lg truncate block">
            {displayName}
          </span>
        </div>
      </button>
    </div>
  )
})

StoryCard.displayName = 'StoryCard'

interface OwnStoryCardProps {
  stories: Story[]
  profile: any
  user: any
  onView: () => void
  onCreate: () => void
}

const OwnStoryCard: React.FC<OwnStoryCardProps> = React.memo(({ stories, profile, user, onView, onCreate }) => {
  if (stories.length > 0) {
    return (
      <div className="shrink-0">
        <button
          onClick={onView}
          className="relative sm:w-40 sm:h-64 w-34 h-55 rounded-2xl group cursor-pointer"
        >
          <div className="absolute inset-0">
            {stories[0].media_url ? (
              <img
                src={stories[0].media_url}
                alt="Your story"
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600"></div>
            )}
            <div className="absolute inset-0 bg-black/20"></div>
          </div>
          
          <div className="absolute top-3 left-3 z-10">
            <div className="w-12 h-12 rounded-full overflow-hidden border-3 border-white shadow-md">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Your profile"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full bg-primary-500 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">
                    {profile?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <div
            className="absolute top-3 right-3 z-10"
            onClick={(e) => {
              e.stopPropagation()
              onCreate()
            }}
          >
            <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center border-3 border-white hover:bg-primary-700 transition-colors cursor-pointer shadow-md">
              <Plus className="w-4 h-4 text-white" />
            </div>
          </div>

          <div className="absolute bottom-3 left-3 right-3 z-10">
            <span className="text-white text-sm font-bold drop-shadow-lg truncate block">
              Your story
            </span>
          </div>
        </button>
      </div>
    )
  }

  return (
    <div className="shrink-0">
      <button
        onClick={onCreate}
        className="relative sm:w-40 sm:h-64 w-34 h-55 !rounded-2xl !overflow-hidden group cursor-pointer"
      >
        <div className="absolute inset-0">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt="Your profile"
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-cyan-200 via-blue-300 to-blue-400 flex items-center justify-center">
              <span className="text-white text-6xl font-bold">
                {profile?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-black/30"></div>
        </div>

        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-4">
          <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center shadow-lg hover:bg-primary-700 transition-colors">
            <Plus className="w-8 h-8 text-white" />
          </div>
        </div>

        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 w-full">
          <span className="text-white text-sm font-bold drop-shadow-lg">Create story</span>
        </div>
      </button>
    </div>
  )
})

OwnStoryCard.displayName = 'OwnStoryCard'

const LoadingSkeleton: React.FC = React.memo(() => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
    <div className="flex space-x-4 justify-around sm:justify-start">
      {[...Array(4)].map((_, index) => (
        <div key={index} className="shrink-0">
          <div className="w-16 h-16 bg-gray-200 rounded-full animate-pulse" />
          <div className="w-16 h-4 bg-gray-200 rounded mt-2 animate-pulse" />
        </div>
      ))}
    </div>
  </div>
))

LoadingSkeleton.displayName = 'LoadingSkeleton'

const StoriesBar: React.FC = () => {
  const { user } = useAuth()
  const { profile } = useProfile()
  const [stories, setStories] = useState<Story[]>([])
  const [userOwnStories, setUserOwnStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isViewerOpen, setIsViewerOpen] = useState(false)
  const [selectedStoryIndex, setSelectedStoryIndex] = useState(0)
  const [viewerStories, setViewerStories] = useState<Story[]>([])

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

      const uniqueUserStories = Array.from(storiesByUser.values())
      setStories(uniqueUserStories)

      const enrichedOwnStories = ownStories.map(story => ({
        ...story,
        user_name: story.user_name || profile?.full_name || user.user_metadata?.full_name || 'You',
        user_avatar: story.user_avatar || profile?.avatar_url || user.user_metadata?.avatar_url || ''
      }))
      setUserOwnStories(enrichedOwnStories)
    } catch (error) {
      console.error('Error loading stories:', error)
    } finally {
      setLoading(false)
    }
  }, [user?.id, profile?.full_name, profile?.avatar_url, user?.user_metadata?.full_name, user?.user_metadata?.avatar_url])

  useEffect(() => {
    loadStories()
  }, [loadStories])

  const handleCreateStory = useCallback(() => {
    setIsCreateModalOpen(true)
  }, [])

  const handleStoryCreated = useCallback(() => {
    loadStories()
  }, [loadStories])

  const handleViewStory = useCallback(async (storyIndex: number) => {
    const selectedStory = stories[storyIndex]
    if (!selectedStory || !user?.id) return

    try {
      const userStories = await getStoriesByUser(selectedStory.user_id, user.id)
      const userStoryIndex = userStories.findIndex(story => story.id === selectedStory.id)
      
      setViewerStories(userStories)
      setSelectedStoryIndex(userStoryIndex >= 0 ? userStoryIndex : 0)
      setIsViewerOpen(true)
    } catch (error) {
      console.error('Error loading user stories:', error)
      setViewerStories(stories)
      setSelectedStoryIndex(storyIndex)
      setIsViewerOpen(true)
    }
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
      />
    )), [stories, handleViewStory]
  )

  if (loading) {
    return <LoadingSkeleton />
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-nowrap space-x-3 overflow-x-scroll touch-pan-x scrollbar-hide">
          <OwnStoryCard
            stories={userOwnStories}
            profile={profile}
            user={user}
            onView={handleViewOwnStories}
            onCreate={handleCreateStory}
          />

          {storyCards}

          {stories.length === 0 && (
            <div className="shrink-0">
              <div className="sm:w-40 sm:h-64 w-34 h-55 bg-gray-100 rounded-2xl flex items-center justify-center shadow-sm border border-gray-200">
                <span className="text-gray-400 text-sm text-center px-4">No stories yet</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <CreateStoryModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onStoryCreated={handleStoryCreated}
      />

      <StoriesViewer
        isOpen={isViewerOpen}
        onClose={handleViewerClose}
        stories={viewerStories}
        initialStoryIndex={selectedStoryIndex}
      />
    </>
  )
}

export default StoriesBar
