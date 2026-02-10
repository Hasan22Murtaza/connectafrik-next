import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
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

export const useGroupPostReactions = (groupPostId: string) => {
  const { user } = useAuth()
  const [reactions, setReactions] = useState<GroupPostReactionsData>({
    totalCount: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (groupPostId) {
      fetchReactions()
    }
  }, [groupPostId, user?.id])

  // Listen for reaction updates and refetch
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
  }, [groupPostId])

  const fetchReactions = async () => {
    try {
      setLoading(true)

      // Fetch all reactions
      const { data: reactionsData, error: reactionsError } = await supabase
        .from('group_post_reactions')
        .select('id, group_post_id, user_id, reaction_type, created_at')
        .eq('group_post_id', groupPostId)
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
      const groupedReactions: { [key: string]: GroupReactionGroup } = {}
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
      console.error('Error fetching group post reactions:', error.message)
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
