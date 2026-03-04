import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'

export interface PostReaction {
  type: 'like' | 'love' | 'laugh' | 'angry' | 'sad'
  count: number
  userReacted: boolean
}

export interface PostReactions {
  [key: string]: PostReaction
}

export const usePostReactions = (postId: string) => {
  const { user } = useAuth()
  const [reactions, setReactions] = useState<PostReactions>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (postId) {
      fetchReactions()
    }
  }, [postId, user])

  const fetchReactions = async () => {
    try {
      setLoading(true)

      const res = await apiClient.get<{
        data: Array<{ type: string; count: number; users: any[]; currentUserReacted: boolean }>
        totalCount: number
      }>(`/api/posts/${postId}/reaction`)

      const processedReactions: PostReactions = {}

      const defaultReactions = ['like', 'love'] as const
      defaultReactions.forEach(type => {
        processedReactions[type] = { type, count: 0, userReacted: false }
      })

      if (res.data) {
        res.data.forEach((group) => {
          const reactionType = group.type
          processedReactions[reactionType] = {
            type: reactionType as PostReaction['type'],
            count: group.count,
            userReacted: group.currentUserReacted,
          }
        })
      }

      setReactions(processedReactions)
    } catch (error: any) {
      console.error('Error fetching reactions:', error.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleReaction = async (reactionType: 'like' | 'love') => {
    try {
      if (!user) throw new Error('User not authenticated')

      const res = await apiClient.post<{ action: string; reaction_type: string }>(
        `/api/posts/${postId}/reaction`,
        { reaction_type: reactionType }
      )

      setReactions(prev => {
        const current = prev[reactionType] || { type: reactionType, count: 0, userReacted: false }
        return {
          ...prev,
          [reactionType]: {
            type: reactionType,
            count: res.action === 'removed'
              ? Math.max(0, current.count - 1)
              : res.action === 'added'
                ? current.count + 1
                : current.count,
            userReacted: res.action !== 'removed',
          },
        }
      })

      return { error: null }
    } catch (error: any) {
      console.error('Error toggling reaction:', error.message)
      return { error: error.message }
    }
  }

  const getReactionCount = (type: 'like' | 'love'): number => {
    return reactions[type]?.count || 0
  }

  const hasUserReacted = (type: 'like' | 'love'): boolean => {
    return reactions[type]?.userReacted || false
  }

  return {
    reactions,
    loading,
    toggleReaction,
    getReactionCount,
    hasUserReacted,
    refetch: fetchReactions
  }
}
