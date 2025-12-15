import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export interface PostReaction {
  type: 'like' | 'love' | 'laugh' | 'angry' | 'sad'
  count: number
  userReacted: boolean
}

export interface PostReactions {
  [key: string]: PostReaction // key is reaction type
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

      // Fetch reaction counts using a more compatible query
      const { data: reactionCounts, error: countsError } = await supabase
        .from('post_reactions')
        .select('reaction_type')
        .eq('post_id', postId)

      if (countsError) throw countsError

      // Fetch user's reactions
      let userReactions: any[] = []
      if (user) {
        const { data, error: userError } = await supabase
          .from('post_reactions')
          .select('reaction_type')
          .eq('post_id', postId)
          .eq('user_id', user.id)

        if (!userError) {
          userReactions = data || []
        }
      }

      // Process reactions
      const processedReactions: PostReactions = {}
      
      // Initialize default reactions
      const defaultReactions = ['like', 'love'] as const
      defaultReactions.forEach(type => {
        processedReactions[type] = {
          type,
          count: 0,
          userReacted: false
        }
      })

      // Count reactions by type
      const reactionTypeCounts: { [key: string]: number } = {}
      reactionCounts?.forEach((reaction: any) => {
        reactionTypeCounts[reaction.reaction_type] = (reactionTypeCounts[reaction.reaction_type] || 0) + 1
      })

      // Update with actual counts
      Object.entries(reactionTypeCounts).forEach(([reactionType, count]) => {
        processedReactions[reactionType] = {
          type: reactionType as 'like' | 'love',
          count: count,
          userReacted: userReactions.some(ur => ur.reaction_type === reactionType)
        }
      })

      // Update user reactions
      userReactions.forEach(userReaction => {
        if (processedReactions[userReaction.reaction_type]) {
          processedReactions[userReaction.reaction_type].userReacted = true
        }
      })

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

      const { data, error } = await supabase
        .rpc('toggle_post_reaction', {
          post_id_param: postId,
          reaction_type_param: reactionType
        })

      if (error) throw error

      const result = data?.[0]
      if (result) {
        setReactions(prev => ({
          ...prev,
          [reactionType]: {
            type: reactionType,
            count: result.new_count,
            userReacted: result.action === 'added'
          }
        }))
      }

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