import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api-client'

export interface Story {
  id: string
  author_id: string
  media_url: string
  media_type: 'image' | 'video'
  text_overlay?: string
  background_color: string
  created_at: string
  expires_at: string
  view_count: number
  author_username: string
  author_full_name: string
  author_avatar_url: string | null
  has_viewed: boolean
}

export interface StoryGroup {
  author_id: string
  author_username: string
  author_full_name: string
  author_avatar_url: string | null
  stories: Story[]
  hasUnviewed: boolean
  latestStory: Story
}

interface ActiveStoriesResponse {
  data: Story[]
}

export const useStories = () => {
  const { user } = useAuth()
  const [stories, setStories] = useState<Story[]>([])
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStories()
  }, [user?.id])

  const fetchStories = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await apiClient.get<ActiveStoriesResponse>('/api/stories')
      const storiesData = response.data || []
      setStories(storiesData)

      const grouped = groupStoriesByAuthor(storiesData)
      setStoryGroups(grouped)
    } catch (error: any) {
      setError(error.message)
      console.error('Error fetching stories:', error)
    } finally {
      setLoading(false)
    }
  }

  const groupStoriesByAuthor = (storiesData: Story[]): StoryGroup[] => {
    const grouped: { [key: string]: StoryGroup } = {}

    storiesData.forEach(story => {
      if (!grouped[story.author_id]) {
        grouped[story.author_id] = {
          author_id: story.author_id,
          author_username: story.author_username,
          author_full_name: story.author_full_name,
          author_avatar_url: story.author_avatar_url,
          stories: [],
          hasUnviewed: false,
          latestStory: story
        }
      }

      grouped[story.author_id].stories.push(story)

      if (!story.has_viewed) {
        grouped[story.author_id].hasUnviewed = true
      }

      if (new Date(story.created_at) > new Date(grouped[story.author_id].latestStory.created_at)) {
        grouped[story.author_id].latestStory = story
      }
    })

    return Object.values(grouped).sort((a, b) =>
      new Date(b.latestStory.created_at).getTime() - new Date(a.latestStory.created_at).getTime()
    )
  }

  const createStory = async (storyData: {
    media_url: string
    media_type: 'image' | 'video'
    text_overlay?: string
    background_color?: string
  }) => {
    try {
      if (!user) throw new Error('User not authenticated')

      await apiClient.post('/api/stories', storyData)
      await fetchStories()

      return { data: true, error: null }
    } catch (error: any) {
      console.error('Error creating story:', error)
      return { data: null, error: error.message }
    }
  }

  const markStoryViewed = async (storyId: string) => {
    try {
      if (!user) return

      await apiClient.post(`/api/stories/${storyId}/view`)

      setStories(prev => prev.map(story =>
        story.id === storyId
          ? { ...story, has_viewed: true, view_count: story.view_count + 1 }
          : story
      ))

      const updatedGroups = storyGroups.map(group => ({
        ...group,
        stories: group.stories.map(story =>
          story.id === storyId
            ? { ...story, has_viewed: true, view_count: story.view_count + 1 }
            : story
        ),
        hasUnviewed: group.stories.some(s => s.id === storyId ? false : !s.has_viewed)
      }))

      setStoryGroups(updatedGroups)
    } catch (error: any) {
      console.error('Error marking story as viewed:', error)
    }
  }

  const deleteStory = async (storyId: string) => {
    try {
      if (!user) throw new Error('User not authenticated')

      await apiClient.delete(`/api/stories/${storyId}`)
      await fetchStories()

      return { error: null }
    } catch (error: any) {
      console.error('Error deleting story:', error)
      return { error: error.message }
    }
  }

  return {
    stories,
    storyGroups,
    loading,
    error,
    createStory,
    markStoryViewed,
    deleteStory,
    refetch: fetchStories
  }
}
