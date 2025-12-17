import React, { useState, useEffect } from 'react'
import { Plus, Play } from 'lucide-react'
import { storiesService, Story } from '@/features/social/services/storiesService'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/shared/hooks/useProfile'
import CreateStoryModal from '@/features/social/components/CreateStoryModal'
import StoriesViewer from '@/features/social/components/StoriesViewer'

const StoriesBar: React.FC = () => {
  const { user } = useAuth()
  const { profile } = useProfile()
  const [stories, setStories] = useState<Story[]>([])
  const [userOwnStories, setUserOwnStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isViewerOpen, setIsViewerOpen] = useState(false)
  const [selectedStoryIndex, setSelectedStoryIndex] = useState(0)

  // Load stories on component mount
  useEffect(() => {
    loadStories()
  }, [])

  const loadStories = async () => {
    if (!user) return

    try {
      setLoading(true)

      // Load other users' stories
      const storyRecommendations = await storiesService.getStoryRecommendations(user.id)

      // Group stories by user and take only the most recent story from each user
      const storiesByUser = new Map()
      storyRecommendations.forEach(story => {
        if (!storiesByUser.has(story.user_id) ||
            new Date(story.created_at) > new Date(storiesByUser.get(story.user_id).created_at)) {
          // Ensure user_name and user_avatar are never null/undefined
          const enrichedStory = {
            ...story,
            user_name: story.user_name || 'Unknown User',
            user_avatar: story.user_avatar || ''
          }
          storiesByUser.set(story.user_id, enrichedStory)
        }
      })

      // Convert back to array - now each user has only one story card
      const uniqueUserStories = Array.from(storiesByUser.values())
      setStories(uniqueUserStories)

      // Load user's own stories
      const ownStories = await storiesService.getUserStories(user.id)
      // Ensure own stories also have proper user names
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
  }

  const handleCreateStory = () => {
    setIsCreateModalOpen(true)
  }

  const handleStoryCreated = () => {
    loadStories() // Refresh stories after creating
  }

  const handleViewStory = async (storyIndex: number) => {
    const selectedStory = stories[storyIndex]
    if (!selectedStory || !user) return

    try {
      // Load ALL stories from this specific user
      const userStories = await storiesService.getStoriesByUser(selectedStory.user_id, user.id)
      
      // Find the index of the selected story within the user's stories
      const userStoryIndex = userStories.findIndex(story => story.id === selectedStory.id)
      
      setStories(userStories) // Update stories to show all from this user
      setSelectedStoryIndex(userStoryIndex >= 0 ? userStoryIndex : 0)
      setIsViewerOpen(true)
    } catch (error) {
      console.error('Error loading user stories:', error)
      // Fallback to original behavior
      setSelectedStoryIndex(storyIndex)
      setIsViewerOpen(true)
    }
  }

  const handleViewOwnStories = async () => {
    if (!user || userOwnStories.length === 0) return

    try {
      // Show user's own stories in the viewer
      setStories(userOwnStories)
      setSelectedStoryIndex(0) // Start from the first story
      setIsViewerOpen(true)
    } catch (error) {
      console.error('Error loading own stories:', error)
    }
  }

  const handleViewerClose = () => {
    setIsViewerOpen(false)
    loadStories() // Refresh to update view counts
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex space-x-4">
          {[...Array(5)].map((_, index) => (
            <div key={index} className="flex-shrink-0">
              <div className="w-16 h-16 bg-gray-200 rounded-full animate-pulse" />
              <div className="w-16 h-4 bg-gray-200 rounded mt-2 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-hide">
          {/* User's Own Stories or Create Story Button */}
          <div className="flex-shrink-0">
            {userOwnStories.length > 0 ? (
              // Show user's own stories as a story card
            <button
                onClick={handleViewOwnStories}
                className="relative w-40 h-64 rounded-2xl group cursor-pointer "
              >
                {/* Story Background */}
                <div className="absolute inset-0">
                  {userOwnStories[0].media_url ? (
                    <img
                      src={userOwnStories[0].media_url}
                      alt="Your story"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600"></div>
                  )}
                  <div className="absolute inset-0 bg-black/20"></div>
                </div>
                
                {/* Profile Picture at Top */}
                <div className="absolute top-3 left-3 z-10">
                  <div className="w-12 h-12 rounded-full overflow-hidden border-3 border-white shadow-md">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt="Your profile"
                        className="w-full h-full object-cover"
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
                
                {/* Plus Icon for Create New */}
                <div
                  className="absolute top-3 right-3 z-10"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCreateStory()
                  }}
                >
                  <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center border-3 border-white hover:bg-primary-700 transition-colors cursor-pointer shadow-md">
                    <Plus className="w-4 h-4 text-white" />
                  </div>
                </div>

                {/* User Name at Bottom */}
                <div className="absolute bottom-3 left-3 right-3 z-10">
                  <span className="text-white text-sm font-bold drop-shadow-lg truncate block">
                    Your story
                  </span>
              </div>
            </button>
            ) : (
              // Show create story button when no stories exist
            <button
                onClick={handleCreateStory}
                className="relative w-40 h-64 rounded-2xl overflow-hidden group cursor-pointer "
              >
                {/* Background Image for Create Story - Use user's profile picture as background */}
                <div className="absolute inset-0">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Your profile"
                      className="w-full h-full object-cover"
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

                {/* Plus Icon - Centered */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
                  <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center border-3 border-white shadow-lg hover:bg-primary-700 transition-colors">
                    <Plus className="w-8 h-8 text-white" />
                  </div>
                </div>

                {/* Create Story Text */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
                  <span className="text-white text-sm font-bold drop-shadow-lg">Create story</span>
                </div>
              </button>
            )}
          </div>

          {/* Story Items - Facebook Style */}
          {stories.map((story, index) => (
            <div key={story.id} className="flex-shrink-0">
            <button
                onClick={() => handleViewStory(index)}
                className="relative w-40 h-64 rounded-2xl overflow-hidden group cursor-pointer transition-transform hover:scale-105"
              >
                {/* Story Background */}
                <div className="absolute inset-0">
                  {story.media_url ? (
                    <img
                      src={story.media_url}
                      alt={story.user_name}
                      className="w-full h-full object-cover"
                      />
                    ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-400 to-gray-600"></div>
                  )}
                  <div className="absolute inset-0 bg-black/20"></div>
                      </div>
                
                {/* Profile Picture at Top */}
                <div className="absolute top-3 left-3 z-10">
                  <div className="w-12 h-12 rounded-full overflow-hidden border-3 border-white shadow-md">
                    {story.user_avatar ? (
                      <img
                        src={story.user_avatar}
                        alt={story.user_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                        <span className="text-white font-bold text-lg">
                          {(story.user_name || 'Unknown User').charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Video Play Icon */}
                {story.media_type === 'video' && (
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-5">
                    <div className="w-12 h-12 bg-black/60 rounded-full flex items-center justify-center backdrop-blur-sm">
                      <Play className="w-6 h-6 text-white fill-white" />
                    </div>
                  </div>
                )}

                {/* Music Icon */}
                {story.music_url && (
                  <div className="absolute top-3 right-3 z-10">
                    <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center shadow-md">
                      <span className="text-white text-sm">♪</span>
                    </div>
              </div>
                )}

                {/* User Name at Bottom */}
                <div className="absolute bottom-3 left-3 right-3 z-10">
                  <span className="text-white text-sm font-bold drop-shadow-lg truncate block">
                    {story.user_name || 'Unknown'}
              </span>
                </div>
            </button>
            </div>
          ))}

          {/* Empty State */}
          {stories.length === 0 && (
            <div className="flex-shrink-0">
              <div className="w-40 h-64 bg-gray-100 rounded-2xl flex items-center justify-center shadow-sm border border-gray-200">
                <span className="text-gray-400 text-sm text-center px-4">No stories yet</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Story Modal */}
      <CreateStoryModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onStoryCreated={handleStoryCreated}
      />

      {/* Stories Viewer */}
      <StoriesViewer
        isOpen={isViewerOpen}
        onClose={handleViewerClose}
        stories={stories}
        initialStoryIndex={selectedStoryIndex}
      />
    </>
  )
}

export default StoriesBar