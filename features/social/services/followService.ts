import { supabase } from '@/lib/supabase'
import { notificationService } from '@/shared/services/notificationService'

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

    // Create notification only if the followed user has follow_notifications enabled
    const { data: profile } = await supabase
      .from('profiles')
      .select('follow_notifications, full_name')
      .eq('id', followingId)
      .single()
    const allowFollowNotifications = profile?.follow_notifications !== false
    if (allowFollowNotifications) {
      // Get follower's name for the notification
      const { data: followerProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', followerId)
        .single()
      const followerName = followerProfile?.full_name || 'Someone'

      await notificationService.sendNotification({
        user_id: followingId,
        title: 'New Tap In!',
        body: `${followerName} tapped in to follow you`,
        notification_type: 'follow',
        data: {
          type: 'follow',
          follower_id: followerId,
          follower_name: followerName,
          url: `/user/${followerId}`
        }
      })
    }

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
 * Check if two users follow each other (mutual follow / "friends")
 */
export const checkIsMutual = async (
  userId1: string,
  userId2: string
): Promise<boolean> => {
  try {
    if (userId1 === userId2) return true
    const [aFollowsB, bFollowsA] = await Promise.all([
      checkIsFollowing(userId1, userId2),
      checkIsFollowing(userId2, userId1),
    ])
    return aFollowsB && bFollowsA
  } catch (error) {
    console.error('Error in checkIsMutual:', error)
    return false
  }
}

/**
 * Get set of user IDs that have a mutual follow relationship with currentUser
 */
export const getMutualUserIds = async (
  currentUserId: string,
  userIds: string[]
): Promise<Set<string>> => {
  if (!userIds.length) return new Set()
  const uniq = [...new Set(userIds)]
  const results = await Promise.all(
    uniq.map((id) => (id === currentUserId ? true : checkIsMutual(currentUserId, id)))
  )
  const set = new Set<string>()
  uniq.forEach((id, i) => {
    if (results[i]) set.add(id)
  })
  return set
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
