import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
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

      // Fetch all reactions
      const { data: reactionsData, error: reactionsError } = await supabase
        .from('post_reactions')
        .select('id, post_id, user_id, reaction_type, created_at')
        .eq('post_id', postId)
        .order('created_at', { ascending: false })

      if (reactionsError) throw reactionsError

      // Get unique user IDs
      const userIds = [...new Set(reactionsData?.map((r: any) => r.user_id) || [])]

      // Fetch user profiles
      let userProfiles: { [key: string]: ReactionUser } = {}
      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .in('id', userIds)

        if (!profilesError && profilesData) {
          profilesData.forEach((profile: any) => {
            userProfiles[profile.id] = profile
          })
        }
      }

      // Group reactions by type
      const groupedReactions: { [key: string]: ReactionGroup } = {}
      let totalCount = 0

      reactionsData?.forEach((reaction: any) => {
        const reactionType = reaction.reaction_type
        const reactionUser = userProfiles[reaction.user_id]

        if (!groupedReactions[reactionType]) {
          groupedReactions[reactionType] = {
            type: reactionType,
            count: 0,
            users: [],
            currentUserReacted: false
          }
        }

        groupedReactions[reactionType].count++
        if (reactionUser) {
          // Avoid duplicates
          if (!groupedReactions[reactionType].users.find(u => u.id === reactionUser.id)) {
            groupedReactions[reactionType].users.push(reactionUser)
          }
        }

        // Check if current user reacted with this type
        if (user && reaction.user_id === user.id) {
          groupedReactions[reactionType].currentUserReacted = true
        }

        totalCount++
      })

      setReactions({
        ...groupedReactions,
        totalCount
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

