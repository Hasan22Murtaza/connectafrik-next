import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'

export interface ReactionUser {
  id: string
  username: string
  full_name: string
  avatar_url: string | null
}

export interface GroupReactionGroup {
  type: 'like' | 'love' | 'laugh' | 'angry' | 'sad' | 'wow' | 'care'
  count: number
  users: ReactionUser[]
  currentUserReacted: boolean
}

export interface GroupPostReactionsData {
  [reactionType: string]: GroupReactionGroup | number
  totalCount: number
}

export const useGroupPostReactions = (groupId: string, groupPostId: string) => {
  const { user } = useAuth()
  const [reactions, setReactions] = useState<GroupPostReactionsData>({
    totalCount: 0
  })
  const [loading, setLoading] = useState(true)

  const fetchReactions = async () => {
    if (!groupPostId || !groupId) return

    try {
      setLoading(true)

      const res = await apiClient.get<{
        data: GroupPostReactionsData
      }>(`/api/groups/${groupId}/posts/${groupPostId}/reactions`)

      setReactions(res.data ?? { totalCount: 0 })
    } catch (error: any) {
      console.error('Error fetching group post reactions:', error.message)
      setReactions({ totalCount: 0 })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (groupPostId && groupId) {
      fetchReactions()
    }
  }, [groupId, groupPostId, user?.id])

  useEffect(() => {
    const handleReactionUpdate = (event: CustomEvent) => {
      if (event.detail?.postId === groupPostId) {
        setTimeout(() => {
          fetchReactions()
        }, 300)
      }
    }

    window.addEventListener(
      'group-reaction-updated',
      handleReactionUpdate as EventListener
    )
    return () => {
      window.removeEventListener(
        'group-reaction-updated',
        handleReactionUpdate as EventListener
      )
    }
  }, [groupId, groupPostId])

  return {
    reactions,
    loading,
    refetch: fetchReactions
  }
}
