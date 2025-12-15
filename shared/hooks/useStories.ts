import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

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

export const useStories = () => {
  const { user } = useAuth()
  const [stories, setStories] = useState<Story[]>([])
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStories()
  }, [user])

  const fetchStories = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .rpc('get_active_stories')

      if (fetchError) throw fetchError

      const storiesData = data || []
      setStories(storiesData)

      // Group stories by author
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

      // Keep the latest story as the representative
      if (new Date(story.created_at) > new Date(grouped[story.author_id].latestStory.created_at)) {
        grouped[story.author_id].latestStory = story
      }
    })

    // Sort by latest story creation time
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

      const { data, error } = await supabase
        .from('stories')
        .insert({
          author_id: user.id,
          media_url: storyData.media_url,
          media_type: storyData.media_type,
          text_overlay: storyData.text_overlay,
          background_color: storyData.background_color || '#000000'
        })
        .select()
        .single()

      if (error) throw error

      // Refresh stories
      await fetchStories()

      return { data, error: null }
    } catch (error: any) {
      console.error('Error creating story:', error)
      return { data: null, error: error.message }
    }
  }

  const markStoryViewed = async (storyId: string) => {
    try {
      if (!user) return

      const { error } = await supabase
        .rpc('mark_story_viewed', { story_id_param: storyId })

      if (error) throw error

      // Update local state
      setStories(prev => prev.map(story => 
        story.id === storyId 
          ? { ...story, has_viewed: true, view_count: story.view_count + 1 }
          : story
      ))

      // Update story groups
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

      const { error } = await supabase
        .from('stories')
        .delete()
        .eq('id', storyId)
        .eq('author_id', user.id)

      if (error) throw error

      // Refresh stories
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