import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'

export interface ReactionUser {
  id: string
  username: string
  full_name: string
  avatar_url: string | null
}

export interface PostReactionWithUser {
  id: string
  post_id: string
  user_id: string
  reaction_type: 'like' | 'love' | 'laugh' | 'angry' | 'sad' | 'wow' | 'care'
  created_at: string
  user: ReactionUser
}

export interface ReactionGroup {
  type: 'like' | 'love' | 'laugh' | 'angry' | 'sad' | 'wow' | 'care'
  count: number
  users: ReactionUser[]
  currentUserReacted: boolean
}

export interface PostReactionsData {
  [reactionType: string]: ReactionGroup | number
  totalCount: number
}

export const usePostReactionsWithUsers = (postId: string) => {
  const { user } = useAuth()
  const [reactions, setReactions] = useState<PostReactionsData>({
    totalCount: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (postId) {
      fetchReactions()
    }
  }, [postId, user?.id])

  const fetchReactions = async () => {
    try {
      setLoading(true)

      const res = await apiClient.get<{
        data: ReactionGroup[]
        totalCount: number
      }>(`/api/posts/${postId}/reaction`)

      const groupsByType: Record<string, ReactionGroup> = {}
      ;(res.data || []).forEach((group) => {
        groupsByType[group.type] = group
      })

      setReactions({
        ...groupsByType,
        totalCount: res.totalCount || 0,
      })
    } catch (error: any) {
      console.error('Error fetching reactions with users:', error.message)
      setReactions({ totalCount: 0 })
    } finally {
      setLoading(false)
    }
  }

  return {
    reactions,
    loading,
    refetch: fetchReactions
  }
}
