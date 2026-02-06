import { supabase } from '@/lib/supabase'

// ============================================
// TYPES
// ============================================

export interface Story {
  id: string
  user_id: string
  user_name: string
  user_avatar: string
  username?: string // RPC returns this field
  profile_picture_url?: string // RPC returns this field
  media_url: string
  media_type: 'image' | 'video'
  text_overlay?: string | null // JSON string with text content and styling
  background_color: string // Hex color like '#000000'
  caption?: string | null
  music_url?: string | null
  music_title?: string | null
  music_artist?: string | null
  is_highlight: boolean
  view_count: number
  expires_at: string
  created_at: string
  has_viewed: boolean
  // Computed fields
  reaction_count?: number
  reply_count?: number
  user_reaction?: string | null
}

export interface CreateStoryData {
  media_url: string
  media_type: 'image' | 'video'
  caption?: string
  music_url?: string
  music_title?: string
  music_artist?: string
  text_overlay?: string // JSON string with text content and styling
  background_color?: string // Hex color
  is_highlight?: boolean
}

export interface TextOverlay {
  text: string
  fontSize: number
  fontFamily: string
  color: string
  backgroundColor: string
  align: 'left' | 'center' | 'right'
  x: number
  y: number
  isBold?: boolean
}

export interface StoryView {
  id: string
  story_id: string
  viewer_id: string
  viewed_at: string
  viewer_name?: string
  viewer_avatar?: string
}

export interface StoryReaction {
  id: string
  story_id: string
  user_id: string
  reaction_type: string // 'like', 'love', 'haha', 'wow', 'sad', 'angry'
  created_at: string
  user_name?: string
  user_avatar?: string
}

export interface StoryReply {
  id: string
  story_id: string
  author_id: string
  content: string
  created_at: string
  author_name?: string
  author_avatar?: string
}

// ============================================
// STORY FUNCTIONS
// ============================================

/**
 * Get story recommendations for the current user
 */
export async function getStoryRecommendations(userId: string): Promise<Story[]> {
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
export async function createStory(storyData: CreateStoryData): Promise<Story> {
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
        text_overlay: storyData.text_overlay,
        background_color: storyData.background_color || '#000000',
        is_highlight: storyData.is_highlight || false,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours from now
      })
      .select(`
        id,
        user_id,
        media_url,
        media_type,
        text_overlay,
        background_color,
        caption,
        music_url,
        music_title,
        music_artist,
        is_highlight,
        view_count,
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
      text_overlay: data.text_overlay,
      background_color: data.background_color,
      caption: data.caption,
      music_url: data.music_url,
      music_title: data.music_title,
      music_artist: data.music_artist,
      is_highlight: data.is_highlight,
      view_count: data.view_count || 0,
      expires_at: data.expires_at,
      created_at: data.created_at,
      has_viewed: false
    }
  } catch (error) {
    console.error('Error in createStory:', error)
    throw error
  }
}

/**
 * Delete a story
 */
export async function deleteStory(storyId: string): Promise<void> {
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
 * Get stories from a specific user
 */
export async function getStoriesByUser(userId: string, viewerId: string): Promise<Story[]> {
  try {
    const { data, error } = await supabase
      .from('stories')
      .select(`
        id,
        user_id,
        media_url,
        media_type,
        text_overlay,
        background_color,
        caption,
        music_url,
        music_title,
        music_artist,
        is_highlight,
        view_count,
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
      text_overlay: story.text_overlay,
      background_color: story.background_color,
      caption: story.caption,
      music_url: story.music_url,
      music_title: story.music_title,
      music_artist: story.music_artist,
      is_highlight: story.is_highlight,
      view_count: story.view_count || 0,
      expires_at: story.expires_at,
      created_at: story.created_at,
      has_viewed: false
    }))
  } catch (error) {
    console.error('Error in getStoriesByUser:', error)
    throw error
  }
}

/**
 * Get user's own stories
 */
export async function getUserStories(userId: string): Promise<Story[]> {
  try {
    const { data, error } = await supabase
      .from('stories')
      .select(`
        id,
        user_id,
        media_url,
        media_type,
        text_overlay,
        background_color,
        caption,
        music_url,
        music_title,
        music_artist,
        is_highlight,
        view_count,
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
      text_overlay: story.text_overlay,
      background_color: story.background_color,
      caption: story.caption,
      music_url: story.music_url,
      music_title: story.music_title,
      music_artist: story.music_artist,
      is_highlight: story.is_highlight,
      view_count: story.view_count || 0,
      expires_at: story.expires_at,
      created_at: story.created_at,
      has_viewed: true
    }))
  } catch (error) {
    console.error('Error in getUserStories:', error)
    throw error
  }
}

// ============================================
// STORY VIEWS FUNCTIONS
// ============================================

/**
 * Record a story view
 */
export async function recordStoryView(storyId: string, viewerId: string): Promise<void> {
  try {
    // First try RPC if it exists
    const { error: rpcError } = await supabase.rpc('record_story_view', {
      story_id_param: storyId,
      viewer_id_param: viewerId
    })

    if (rpcError) {
      // Fallback to direct insert
      const { error } = await supabase
        .from('story_views')
        .upsert({
          story_id: storyId,
          viewer_id: viewerId,
          viewed_at: new Date().toISOString()
        }, {
          onConflict: 'story_id,viewer_id',
          ignoreDuplicates: true
        })

      if (error && !error.message.includes('duplicate')) {
        console.error('Error recording story view:', error)
      }
    }
  } catch (error) {
    console.error('Error in recordStoryView:', error)
  }
}

/**
 * Get viewers for a story
 */
export async function getStoryViewers(storyId: string): Promise<StoryView[]> {
  try {
    const { data, error } = await supabase
      .from('story_views')
      .select('id, story_id, viewer_id, viewed_at')
      .eq('story_id', storyId)
      .order('viewed_at', { ascending: false })

    if (error) {
      console.error('Error getting story viewers:', error)
      return []
    }

    if (!data || data.length === 0) return []

    const viewerIds = [...new Set(data.map(v => v.viewer_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', viewerIds)

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])

    return data.map(view => {
      const profile = profileMap.get(view.viewer_id)
      return {
        id: view.id,
        story_id: view.story_id,
        viewer_id: view.viewer_id,
        viewed_at: view.viewed_at,
        viewer_name: profile?.full_name || 'Unknown',
        viewer_avatar: profile?.avatar_url || ''
      }
    })
  } catch (error) {
    console.error('Error in getStoryViewers:', error)
    return []
  }
}

// ============================================
// STORY REACTIONS FUNCTIONS
// ============================================

/**
 * Add or update a reaction to a story
 */
export async function addStoryReaction(
  storyId: string,
  userId: string,
  reactionType: string = 'like'
): Promise<StoryReaction> {
  try {
    const { data, error } = await supabase
      .from('story_reactions')
      .upsert({
        story_id: storyId,
        user_id: userId,
        reaction_type: reactionType,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'story_id,user_id'
      })
      .select(`
        id,
        story_id,
        user_id,
        reaction_type,
        created_at
      `)
      .single()

    if (error) {
      console.error('Error adding story reaction:', error)
      throw error
    }

    return {
      id: data.id,
      story_id: data.story_id,
      user_id: data.user_id,
      reaction_type: data.reaction_type,
      created_at: data.created_at
    }
  } catch (error) {
    console.error('Error in addStoryReaction:', error)
    throw error
  }
}

/**
 * Remove a reaction from a story
 */
export async function removeStoryReaction(storyId: string, userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('story_reactions')
      .delete()
      .eq('story_id', storyId)
      .eq('user_id', userId)

    if (error) {
      console.error('Error removing story reaction:', error)
      throw error
    }
  } catch (error) {
    console.error('Error in removeStoryReaction:', error)
    throw error
  }
}

/**
 * Get reactions for a story
 */
export async function getStoryReactions(storyId: string): Promise<StoryReaction[]> {
  try {
    const { data, error } = await supabase
      .from('story_reactions')
      .select('id, story_id, user_id, reaction_type, created_at')
      .eq('story_id', storyId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error getting story reactions:', error)
      return []
    }

    if (!data || data.length === 0) return []

    const userIds = [...new Set(data.map(r => r.user_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds)

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])

    return data.map(reaction => {
      const profile = profileMap.get(reaction.user_id)
      return {
        id: reaction.id,
        story_id: reaction.story_id,
        user_id: reaction.user_id,
        reaction_type: reaction.reaction_type,
        created_at: reaction.created_at,
        user_name: profile?.full_name || 'Unknown',
        user_avatar: profile?.avatar_url || ''
      }
    })
  } catch (error) {
    console.error('Error in getStoryReactions:', error)
    return []
  }
}

/**
 * Get user's reaction to a story
 */
export async function getUserStoryReaction(storyId: string, userId: string): Promise<StoryReaction | null> {
  try {
    const { data, error } = await supabase
      .from('story_reactions')
      .select('*')
      .eq('story_id', storyId)
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error getting user story reaction:', error)
      throw error
    }

    return data || null
  } catch (error) {
    console.error('Error in getUserStoryReaction:', error)
    return null
  }
}

// ============================================
// STORY REPLIES FUNCTIONS
// ============================================

/**
 * Add a reply to a story
 */
export async function addStoryReply(
  storyId: string,
  authorId: string,
  content: string
): Promise<StoryReply> {
  try {
    const { data, error, status, statusText } = await supabase
      .from('story_replies')
      .insert({
        story_id: storyId,
        author_id: authorId,
        content: content
      })
      .select('id, story_id, author_id, content, created_at')
      .single()

    if (error) {
      console.error('Error adding story reply:', {
        error,
        status,
        statusText,
        storyId,
        authorId,
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      })
      throw new Error(error.message || 'Failed to add reply')
    }

    if (!data) {
      throw new Error('No data returned after inserting reply')
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', authorId)
      .single()

    return {
      id: data.id,
      story_id: data.story_id,
      author_id: data.author_id,
      content: data.content,
      created_at: data.created_at,
      author_name: profile?.full_name || 'Unknown',
      author_avatar: profile?.avatar_url || ''
    }
  } catch (error) {
    console.error('Error in addStoryReply:', error)
    throw error
  }
}

/**
 * Delete a reply from a story
 */
export async function deleteStoryReply(replyId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('story_replies')
      .delete()
      .eq('id', replyId)

    if (error) {
      console.error('Error deleting story reply:', error)
      throw error
    }
  } catch (error) {
    console.error('Error in deleteStoryReply:', error)
    throw error
  }
}

/**
 * Get replies for a story
 */
export async function getStoryReplies(storyId: string): Promise<StoryReply[]> {
  try {
    const { data, error } = await supabase
      .from('story_replies')
      .select('id, story_id, author_id, content, created_at')
      .eq('story_id', storyId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error getting story replies:', error)
      return []
    }

    if (!data || data.length === 0) return []

    const authorIds = [...new Set(data.map(r => r.author_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', authorIds)

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])

    return data.map(reply => {
      const profile = profileMap.get(reply.author_id)
      return {
        id: reply.id,
        story_id: reply.story_id,
        author_id: reply.author_id,
        content: reply.content,
        created_at: reply.created_at,
        author_name: profile?.full_name || 'Unknown',
        author_avatar: profile?.avatar_url || ''
      }
    })
  } catch (error) {
    console.error('Error in getStoryReplies:', error)
    return []
  }
}

// ============================================
// ANALYTICS FUNCTIONS
// ============================================

/**
 * Get story analytics for a user
 */
export async function getStoryAnalytics(userId: string): Promise<{
  totalStories: number
  totalViews: number
  totalReactions: number
  totalReplies: number
  averageViews: number
  topStories: Story[]
}> {
  try {
    const { data: stories, error: storiesError } = await supabase
      .from('stories')
      .select(`
        id,
        user_id,
        media_url,
        media_type,
        text_overlay,
        background_color,
        caption,
        music_url,
        music_title,
        music_artist,
        is_highlight,
        view_count,
        expires_at,
        created_at,
        story_views (id),
        story_reactions (id),
        story_replies (id)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (storiesError) {
      console.error('Error getting story analytics:', storiesError)
      throw storiesError
    }

    const totalStories = stories?.length || 0
    const totalViews = stories?.reduce((sum, story) => sum + (story.view_count || story.story_views?.length || 0), 0) || 0
    const totalReactions = stories?.reduce((sum, story) => sum + (story.story_reactions?.length || 0), 0) || 0
    const totalReplies = stories?.reduce((sum, story) => sum + (story.story_replies?.length || 0), 0) || 0
    const averageViews = totalStories > 0 ? totalViews / totalStories : 0

    const topStories = stories
      ?.map(story => ({
        ...story,
        computed_view_count: story.view_count || story.story_views?.length || 0
      }))
      .sort((a, b) => b.computed_view_count - a.computed_view_count)
      .slice(0, 5) || []

    return {
      totalStories,
      totalViews,
      totalReactions,
      totalReplies,
      averageViews,
      topStories: topStories.map(story => ({
        id: story.id,
        user_id: story.user_id,
        user_name: '',
        user_avatar: '',
        media_url: story.media_url,
        media_type: story.media_type,
        text_overlay: story.text_overlay,
        background_color: story.background_color,
        caption: story.caption,
        music_url: story.music_url,
        music_title: story.music_title,
        music_artist: story.music_artist,
        is_highlight: story.is_highlight,
        view_count: story.computed_view_count,
        expires_at: story.expires_at,
        created_at: story.created_at,
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
export async function cleanupExpiredStories(): Promise<void> {
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
