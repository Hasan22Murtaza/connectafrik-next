import { apiClient, ApiError } from '@/lib/api-client'

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

    await apiClient.post<{ success: boolean; followed?: boolean }>('/api/follow', {
      following_id: followingId,
    })
    return true
  } catch (err) {
    if (err instanceof ApiError) {
      return false
    }
    console.error('Error in followUser:', err)
    return false
  }
}

/**
 * Unfollow a user
 */
export const unfollowUser = async (followerId: string, followingId: string): Promise<boolean> => {
  try {
    await apiClient.delete<{ success: boolean; unfollowed?: boolean }>(
      `/api/follow/${followingId}`
    )
    return true
  } catch (err) {
    if (err instanceof ApiError) {
      return false
    }
    console.error('Error in unfollowUser:', err)
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
    const res = await apiClient.get<{ is_following: boolean }>(
      `/api/follow/${followingId}`
    )
    return res?.is_following ?? false
  } catch (err) {
    if (err instanceof ApiError) {
      return false
    }
    console.error('Error in checkIsFollowing:', err)
    return false
  }
}

/**
 * Get follow stats for a user
 */
export const getFollowStats = async (
  userId: string,
  _currentUserId?: string
): Promise<FollowStats> => {
  try {
    const res = await apiClient.get<{
      follower_count: number
      following_count: number
      is_following: boolean
    }>(`/api/follow/stats/${userId}`)
    return {
      follower_count: res?.follower_count ?? 0,
      following_count: res?.following_count ?? 0,
      is_following: res?.is_following ?? false,
    }
  } catch (err) {
    if (err instanceof ApiError) {
      return {
        follower_count: 0,
        following_count: 0,
        is_following: false,
      }
    }
    console.error('Error in getFollowStats:', err)
    return {
      follower_count: 0,
      following_count: 0,
      is_following: false,
    }
  }
}

export const getFollowers = async (userId: string, limit = 20, offset = 0) => {
  try {
    const res = await apiClient.get<{ data: any[] }>(`/api/follow/${userId}/followers`, { limit, offset })
    return res.data || []
  } catch (error) {
    if (error instanceof ApiError) return []
    console.error('Error in getFollowers:', error)
    return []
  }
}

export const getFollowing = async (userId: string, limit = 20, offset = 0) => {
  try {
    const res = await apiClient.get<{ data: any[] }>(`/api/follow/${userId}/following`, { limit, offset })
    return res.data || []
  } catch (error) {
    if (error instanceof ApiError) return []
    console.error('Error in getFollowing:', error)
    return []
  }
}
