import { supabase } from '@/lib/supabase'

export interface FollowStats {
  follower_count: number
  following_count: number
  is_following: boolean
}

/**
 * Follow a user
 */
export const followUser = async (followerId: string, followingId: string): Promise<boolean> => {
  try {
    if (followerId === followingId) {
      console.error('Cannot follow yourself')
      return false
    }

    // Check if already following
    const { data: existing } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
      .maybeSingle()

    if (existing) {
      console.log('Already following this user')
      // Return false to indicate no new follow was created
      return false
    }

    // Create follow relationship
    const { error } = await supabase
      .from('follows')
      .insert({
        follower_id: followerId,
        following_id: followingId,
      })

    if (error) {
      // Check if it's a duplicate key error (23505)
      if (error.code === '23505') {
        console.log('Already following (caught by constraint)')
        return false
      }
      console.error('Error following user:', error)
      return false
    }

    // Update follower counts
    await Promise.all([
      // Increment following count for follower
      supabase.rpc('increment_following_count', { user_id: followerId }),
      // Increment follower count for following
      supabase.rpc('increment_follower_count', { user_id: followingId }),
    ])

    // Create notification for the followed user
    await supabase.from('notifications').insert({
      user_id: followingId,
      type: 'follow',
      title: 'New Tap In!',
      message: 'Someone tapped in to follow you',
      data: {
        follower_id: followerId,
      },
      is_read: false,
    })

    return true
  } catch (error) {
    console.error('Error in followUser:', error)
    return false
  }
}

/**
 * Unfollow a user
 */
export const unfollowUser = async (followerId: string, followingId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId)

    if (error) {
      console.error('Error unfollowing user:', error)
      return false
    }

    // Update follower counts
    await Promise.all([
      // Decrement following count for follower
      supabase.rpc('decrement_following_count', { user_id: followerId }),
      // Decrement follower count for following
      supabase.rpc('decrement_follower_count', { user_id: followingId }),
    ])

    return true
  } catch (error) {
    console.error('Error in unfollowUser:', error)
    return false
  }
}

/**
 * Check if user is following another user
 */
export const checkIsFollowing = async (
  followerId: string,
  followingId: string
): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
      .maybeSingle()

    if (error) {
      console.error('Error checking follow status:', error)
      return false
    }

    if (!data) {
      return false
    }

    // Legacy error handling (no longer needed with maybeSingle)
    if (false) {
      // 406 error or other API errors - silently return false
      // This allows the button to still show, just not pre-checked
      if ((error as any)?.message?.includes('406') || (error as any)?.code === 'PGRST301') {
        console.warn('follows table not accessible via API yet - follow status unknown')
        return false
      }
      console.error('Error checking follow status:', error)
      return false
    }

    return !!data
  } catch (error) {
    console.error('Error in checkIsFollowing:', error)
    return false
  }
}

/**
 * Get follow stats for a user
 */
export const getFollowStats = async (
  userId: string,
  currentUserId?: string
): Promise<FollowStats> => {
  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('follower_count, following_count')
      .eq('id', userId)
      .single()

    if (profileError) {
      console.error('Error fetching profile stats:', profileError)
      return {
        follower_count: 0,
        following_count: 0,
        is_following: false,
      }
    }

    let isFollowing = false
    if (currentUserId && currentUserId !== userId) {
      isFollowing = await checkIsFollowing(currentUserId, userId)
    }

    return {
      follower_count: profile?.follower_count || 0,
      following_count: profile?.following_count || 0,
      is_following: isFollowing,
    }
  } catch (error) {
    console.error('Error in getFollowStats:', error)
    return {
      follower_count: 0,
      following_count: 0,
      is_following: false,
    }
  }
}

/**
 * Get list of followers for a user
 */
export const getFollowers = async (userId: string, limit = 20, offset = 0) => {
  try {
    const { data, error } = await supabase
      .from('follows')
      .select(`
        follower_id,
        created_at,
        follower:profiles!follows_follower_id_fkey(
          id,
          username,
          full_name,
          avatar_url
        )
      `)
      .eq('following_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching followers:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error in getFollowers:', error)
    return []
  }
}

/**
 * Get list of users being followed
 */
export const getFollowing = async (userId: string, limit = 20, offset = 0) => {
  try {
    const { data, error } = await supabase
      .from('follows')
      .select(`
        following_id,
        created_at,
        following:profiles!follows_following_id_fkey(
          id,
          username,
          full_name,
          avatar_url
        )
      `)
      .eq('follower_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching following:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error in getFollowing:', error)
    return []
  }
}
