import { supabase } from '@/lib/supabase'

export interface Story {
  id: string
  user_id: string
  user_name: string
  user_avatar: string
  media_url: string
  media_type: 'image' | 'video'
  caption?: string
  music_url?: string
  music_title?: string
  music_artist?: string
  expires_at: string
  created_at: string
  view_count: number
  has_viewed: boolean
}

export interface CreateStoryData {
  media_url: string
  media_type: 'image' | 'video'
  caption?: string
  music_url?: string
  music_title?: string
  music_artist?: string
}

class StoriesService {
  /**
   * Get story recommendations for the current user
   */
  async getStoryRecommendations(userId: string): Promise<Story[]> {
    try {
      const { data, error } = await supabase.rpc('get_story_recommendations', {
        user_id_param: userId
      })

      if (error) {
        console.error('Error getting story recommendations:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error in getStoryRecommendations:', error)
      throw error
    }
  }

  /**
   * Create a new story
   */
  async createStory(storyData: CreateStoryData): Promise<Story> {
    try {
      const { data, error } = await supabase
        .from('stories')
        .insert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          media_url: storyData.media_url,
          media_type: storyData.media_type,
          caption: storyData.caption,
          music_url: storyData.music_url,
          music_title: storyData.music_title,
          music_artist: storyData.music_artist,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours from now
        })
        .select(`
          id,
          user_id,
          media_url,
          media_type,
          caption,
          music_url,
          music_title,
          music_artist,
          expires_at,
          created_at,
          profiles!stories_user_id_fkey (
            full_name,
            avatar_url
          )
        `)
        .single()

      if (error) {
        console.error('Error creating story:', error)
        throw error
      }

      const profileData = data.profiles as any
      return {
        id: data.id,
        user_id: data.user_id,
        user_name: profileData?.full_name || 'Unknown',
        user_avatar: profileData?.avatar_url || '',
        media_url: data.media_url,
        media_type: data.media_type,
        caption: data.caption,
        music_url: data.music_url,
        music_title: data.music_title,
        music_artist: data.music_artist,
        expires_at: data.expires_at,
        created_at: data.created_at,
        view_count: 0,
        has_viewed: false
      }
    } catch (error) {
      console.error('Error in createStory:', error)
      throw error
    }
  }

  /**
   * Record a story view
   */
  async recordStoryView(storyId: string, viewerId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('record_story_view', {
        story_id_param: storyId,
        viewer_id_param: viewerId
      })

      if (error) {
        console.error('Error recording story view:', error)
        throw error
      }
    } catch (error) {
      console.error('Error in recordStoryView:', error)
      throw error
    }
  }

  /**
   * Delete a story
   */
  async deleteStory(storyId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('stories')
        .delete()
        .eq('id', storyId)

      if (error) {
        console.error('Error deleting story:', error)
        throw error
      }
    } catch (error) {
      console.error('Error in deleteStory:', error)
      throw error
    }
  }

  /**
   * Get stories from a specific user (for viewing other users' stories)
   */
  async getStoriesByUser(userId: string, viewerId: string): Promise<Story[]> {
    try {
      const { data, error } = await supabase
        .from('stories')
        .select(`
          id,
          user_id,
          media_url,
          media_type,
          caption,
          music_url,
          music_title,
          music_artist,
          expires_at,
          created_at,
          profiles!stories_user_id_fkey (
            full_name,
            avatar_url
          )
        `)
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error getting stories by user:', error)
        throw error
      }

      return (data || []).map(story => ({
        id: story.id,
        user_id: story.user_id,
        user_name: ((story as any).profiles?.full_name) || 'Unknown',
        user_avatar: ((story as any).profiles?.avatar_url) || '',
        media_url: story.media_url,
        media_type: story.media_type,
        caption: story.caption,
        music_url: story.music_url,
        music_title: story.music_title,
        music_artist: story.music_artist,
        expires_at: story.expires_at,
        created_at: story.created_at,
        view_count: 0, // This would need a separate query to get actual view count
        has_viewed: false // This would need to be checked against story_views table
      }))
    } catch (error) {
      console.error('Error in getStoriesByUser:', error)
      throw error
    }
  }

  /**
   * Get user's own stories
   */
  async getUserStories(userId: string): Promise<Story[]> {
    try {
      const { data, error } = await supabase
        .from('stories')
        .select(`
          id,
          user_id,
          media_url,
          media_type,
          caption,
          music_url,
          music_title,
          music_artist,
          expires_at,
          created_at,
          profiles!stories_user_id_fkey (
            full_name,
            avatar_url
          )
        `)
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error getting user stories:', error)
        throw error
      }

      return (data || []).map(story => ({
        id: story.id,
        user_id: story.user_id,
        user_name: ((story as any).profiles?.full_name) || 'Unknown',
        user_avatar: ((story as any).profiles?.avatar_url) || '',
        media_url: story.media_url,
        media_type: story.media_type,
        caption: story.caption,
        music_url: story.music_url,
        music_title: story.music_title,
        music_artist: story.music_artist,
        expires_at: story.expires_at,
        created_at: story.created_at,
        view_count: 0, // This would need a separate query to get actual view count
        has_viewed: true // User has viewed their own stories
      }))
    } catch (error) {
      console.error('Error in getUserStories:', error)
      throw error
    }
  }

  /**
   * Get story analytics for a user
   */
  async getStoryAnalytics(userId: string): Promise<{
    totalStories: number
    totalViews: number
    averageViews: number
    topStories: Story[]
  }> {
    try {
      // Get user's stories with view counts
      const { data: stories, error: storiesError } = await supabase
        .from('stories')
        .select(`
          id,
          user_id,
          media_url,
          media_type,
          caption,
          music_url,
          music_title,
          music_artist,
          expires_at,
          created_at,
          story_views (id)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (storiesError) {
        console.error('Error getting story analytics:', storiesError)
        throw storiesError
      }

      const totalStories = stories?.length || 0
      const totalViews = stories?.reduce((sum, story) => sum + (story.story_views?.length || 0), 0) || 0
      const averageViews = totalStories > 0 ? totalViews / totalStories : 0

      // Get top 5 stories by view count
      const topStories = stories
        ?.map(story => ({
          ...story,
          view_count: story.story_views?.length || 0
        }))
        .sort((a, b) => b.view_count - a.view_count)
        .slice(0, 5) || []

      return {
        totalStories,
        totalViews,
        averageViews,
        topStories: topStories.map(story => ({
          id: story.id,
          user_id: story.user_id,
          user_name: '', // Would need to join with profiles
          user_avatar: '',
          media_url: story.media_url,
          media_type: story.media_type,
          caption: story.caption,
          music_url: story.music_url,
          music_title: story.music_title,
          music_artist: story.music_artist,
          expires_at: story.expires_at,
          created_at: story.created_at,
          view_count: story.view_count,
          has_viewed: true
        }))
      }
    } catch (error) {
      console.error('Error in getStoryAnalytics:', error)
      throw error
    }
  }

  /**
   * Clean up expired stories (admin function)
   */
  async cleanupExpiredStories(): Promise<void> {
    try {
      const { error } = await supabase.rpc('delete_expired_stories')

      if (error) {
        console.error('Error cleaning up expired stories:', error)
        throw error
      }
    } catch (error) {
      console.error('Error in cleanupExpiredStories:', error)
      throw error
    }
  }
}

// Export singleton instance
export const storiesService = new StoriesService()

// Export the class for testing
export { StoriesService }
