import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { 
  Reel, 
  CreateReelData, 
  UpdateReelData, 
  ReelFilters, 
  ReelSortOptions,
  ReelComment,
  ReelInteractionState,
  ReelCategory
} from '../types/reels'

export const useReels = (filters: ReelFilters = {}, sortOptions: ReelSortOptions = { field: 'created_at', order: 'desc' }) => {
  const { user } = useAuth()
  const [reels, setReels] = useState<Reel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const pageSize = 10

  const fetchReels = useCallback(async (pageNum: number = 0, append: boolean = false, currentFilters = filters, currentSortOptions = sortOptions) => {
    try {
      console.log('Fetching reels...', { pageNum, append, currentFilters, currentSortOptions })
      setLoading(true)
      setError(null)

      let query = supabase
        .from('reels')
        .select(`
          *,
          profiles:profiles!reels_author_id_fkey (
            username,
            full_name,
            avatar_url
          )
        `)
        .eq('is_deleted', false)
        .eq('is_public', true)

      // Apply filters
      if (currentFilters?.category) {
        query = query.eq('category', currentFilters.category)
      }
      if (currentFilters?.author_id) {
        query = query.eq('author_id', currentFilters.author_id)
      }
      if (currentFilters?.is_featured) {
        query = query.eq('is_featured', true)
      }
      if (currentFilters?.min_duration) {
        query = query.gte('duration', currentFilters.min_duration)
      }
      if (currentFilters?.max_duration) {
        query = query.lte('duration', currentFilters.max_duration)
      }
      if (currentFilters?.tags && currentFilters.tags.length > 0) {
        query = query.overlaps('tags', currentFilters.tags)
      }
      if (currentFilters?.search) {
        query = query.or(`title.ilike.%${currentFilters.search}%,description.ilike.%${currentFilters.search}%`)
      }

      // Apply sorting
      const sortField = currentSortOptions?.field || 'created_at'
      const sortOrder = currentSortOptions?.order || 'desc'
      query = query.order(sortField, { ascending: sortOrder === 'asc' })

      // Apply pagination
      const from = pageNum * pageSize
      const to = from + pageSize - 1
      query = query.range(from, to)

      const { data, error: fetchError, count } = await query

      console.log('Query result:', { data, error: fetchError, count, dataLength: data?.length })

      if (fetchError) {
        console.error('Fetch error:', fetchError)
        throw fetchError
      }

      const newReels = data || []
      console.log('New reels:', newReels.length)
      
      if (append) {
        setReels(prev => [...prev, ...newReels])
      } else {
        setReels(newReels)
      }

      setHasMore(newReels.length === pageSize)
      setPage(pageNum)
    } catch (err) {
      console.error('Error fetching reels:', err)
      console.error('Error details:', {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
        cause: (err as any)?.cause
      })
      setError(err instanceof Error ? err.message : 'Failed to fetch reels')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchReels(page + 1, true, filters, sortOptions)
    }
  }, [loading, hasMore, page, fetchReels, filters, sortOptions])

  const refresh = useCallback(() => {
    fetchReels(0, false, filters, sortOptions)
  }, [fetchReels, filters, sortOptions])

  useEffect(() => {
    fetchReels(0, false, filters, sortOptions)
  }, [JSON.stringify(filters), JSON.stringify(sortOptions)])

  return {
    reels,
    loading,
    error,
    hasMore,
    loadMore,
    refresh
  }
}

export const useReel = (reelId: string) => {
  const { user } = useAuth()
  const [reel, setReel] = useState<Reel | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [interactionState, setInteractionState] = useState<ReelInteractionState>({
    isLiked: false,
    isSaved: false,
    isFollowing: false,
    hasViewed: false
  })

  const fetchReel = useCallback(async () => {
    if (!reelId) return

    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('reels')
        .select(`
          *,
          profiles!reels_author_id_fkey(username, full_name, avatar_url)
        `)
        .eq('id', reelId)
        .eq('is_deleted', false)
        .single()

      if (fetchError) {
        throw fetchError
      }

      setReel(data)

      // Fetch interaction state if user is logged in
      if (user) {
        await fetchInteractionState(reelId)
      }
    } catch (err) {
      console.error('Error fetching reel:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch reel')
    } finally {
      setLoading(false)
    }
  }, [reelId, user])

  const fetchInteractionState = useCallback(async (reelId: string) => {
    if (!user) return

    try {
      // Check if user liked the reel
      const { data: likeData } = await supabase
        .from('reel_likes')
        .select('id')
        .eq('reel_id', reelId)
        .eq('user_id', user.id)
        .single()

      // Check if user saved the reel
      const { data: saveData } = await supabase
        .from('reel_saves')
        .select('id')
        .eq('reel_id', reelId)
        .eq('user_id', user.id)
        .single()

      // Check if user is following the author
      const { data: followData } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', reel?.author_id)
        .single()

      // Check if user has viewed the reel
      const { data: viewData } = await supabase
        .from('reel_views')
        .select('id')
        .eq('reel_id', reelId)
        .eq('user_id', user.id)
        .single()

      setInteractionState({
        isLiked: !!likeData,
        isSaved: !!saveData,
        isFollowing: !!followData,
        hasViewed: !!viewData
      })
    } catch (err) {
      // These queries will fail if no records exist, which is expected
      console.log('Interaction state check completed')
    }
  }, [user, reel?.author_id])

  useEffect(() => {
    fetchReel()
  }, [fetchReel])

  return {
    reel,
    loading,
    error,
    interactionState,
    refresh: fetchReel
  }
}

export const useCreateReel = () => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createReel = useCallback(async (reelData: CreateReelData) => {
    if (!user) {
      throw new Error('User must be logged in to create a reel')
    }

    try {
      setLoading(true)
      setError(null)

      const { data, error: createError } = await supabase
        .from('reels')
        .insert({
          ...reelData,
          author_id: user.id,
          aspect_ratio: reelData.aspect_ratio || '9:16',
          category: reelData.category || 'entertainment',
          tags: reelData.tags || [],
          is_public: reelData.is_public ?? true
        })
        .select()
        .single()

      if (createError) {
        throw createError
      }

      return { data, error: null }
    } catch (err) {
      console.error('Error creating reel:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to create reel'
      setError(errorMessage)
      return { data: null, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }, [user])

  return {
    createReel,
    loading,
    error
  }
}

export const useReelInteractions = (reelId: string) => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleLike = useCallback(async () => {
    if (!user) {
      throw new Error('User must be logged in to like a reel')
    }

    try {
      setLoading(true)
      setError(null)

      // Check if already liked
      const { data: existingLike } = await supabase
        .from('reel_likes')
        .select('id')
        .eq('reel_id', reelId)
        .eq('user_id', user.id)
        .single()

      if (existingLike) {
        // Unlike
        const { error: unlikeError } = await supabase
          .from('reel_likes')
          .delete()
          .eq('reel_id', reelId)
          .eq('user_id', user.id)

        if (unlikeError) throw unlikeError
      } else {
        // Like
        const { error: likeError } = await supabase
          .from('reel_likes')
          .insert({
            reel_id: reelId,
            user_id: user.id
          })

        if (likeError) throw likeError
      }

      return { success: true, error: null }
    } catch (err) {
      console.error('Error toggling reel like:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to toggle like'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }, [user, reelId])

  const toggleSave = useCallback(async () => {
    if (!user) {
      throw new Error('User must be logged in to save a reel')
    }

    try {
      setLoading(true)
      setError(null)

      // Check if already saved
      const { data: existingSave } = await supabase
        .from('reel_saves')
        .select('id')
        .eq('reel_id', reelId)
        .eq('user_id', user.id)
        .single()

      if (existingSave) {
        // Unsave
        const { error: unsaveError } = await supabase
          .from('reel_saves')
          .delete()
          .eq('reel_id', reelId)
          .eq('user_id', user.id)

        if (unsaveError) throw unsaveError
      } else {
        // Save
        const { error: saveError } = await supabase
          .from('reel_saves')
          .insert({
            reel_id: reelId,
            user_id: user.id
          })

        if (saveError) throw saveError
      }

      return { success: true, error: null }
    } catch (err) {
      console.error('Error toggling reel save:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to toggle save'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }, [user, reelId])

  const recordView = useCallback(async (viewDuration?: number, completionRate?: number) => {
    if (!user) return

    try {
      await supabase
        .from('reel_views')
        .insert({
          reel_id: reelId,
          user_id: user.id,
          view_duration: viewDuration,
          completion_rate: completionRate
        })
    } catch (err) {
      console.error('Error recording reel view:', err)
    }
  }, [user, reelId])

  const shareReel = useCallback(async (shareType: 'copy_link' | 'social_media' | 'direct_message' | 'story', platform?: string) => {
    if (!user) {
      throw new Error('User must be logged in to share a reel')
    }

    try {
      setLoading(true)
      setError(null)

      const { error: shareError } = await supabase
        .from('reel_shares')
        .insert({
          reel_id: reelId,
          user_id: user.id,
          share_type: shareType,
          platform
        })

      if (shareError) throw shareError

      return { success: true, error: null }
    } catch (err) {
      console.error('Error sharing reel:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to share reel'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }, [user, reelId])

  return {
    toggleLike,
    toggleSave,
    recordView,
    shareReel,
    loading,
    error
  }
}

export const useReelComments = (reelId: string) => {
  const { user } = useAuth()
  const [comments, setComments] = useState<ReelComment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchComments = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('reel_comments')
        .select(`
          *,
          profiles!reel_comments_user_id_fkey(username, full_name, avatar_url)
        `)
        .eq('reel_id', reelId)
        .eq('is_deleted', false)
        .is('parent_id', null) // Only top-level comments
        .order('created_at', { ascending: false })

      if (fetchError) {
        throw fetchError
      }

      // Fetch replies for each comment
      const commentsWithReplies = await Promise.all(
        (data || []).map(async (comment) => {
          const { data: replies } = await supabase
            .from('reel_comments')
            .select(`
              *,
              profiles!reel_comments_user_id_fkey(username, full_name, avatar_url)
            `)
            .eq('parent_id', comment.id)
            .eq('is_deleted', false)
            .order('created_at', { ascending: true })

          return {
            ...comment,
            replies: replies || []
          }
        })
      )

      setComments(commentsWithReplies)
    } catch (err) {
      console.error('Error fetching reel comments:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch comments')
    } finally {
      setLoading(false)
    }
  }, [reelId])

  const addComment = useCallback(async (content: string, parentId?: string) => {
    if (!user) {
      throw new Error('User must be logged in to comment')
    }

    try {
      setLoading(true)
      setError(null)

      const { data, error: addError } = await supabase
        .from('reel_comments')
        .insert({
          reel_id: reelId,
          user_id: user.id,
          content,
          parent_id: parentId
        })
        .select(`
          *,
          profiles!reel_comments_user_id_fkey(username, full_name, avatar_url)
        `)
        .single()

      if (addError) {
        throw addError
      }

      // Refresh comments
      await fetchComments()

      return { data, error: null }
    } catch (err) {
      console.error('Error adding reel comment:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to add comment'
      setError(errorMessage)
      return { data: null, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }, [user, reelId, fetchComments])

  const deleteComment = useCallback(async (commentId: string) => {
    if (!user) {
      throw new Error('User must be logged in to delete a comment')
    }

    try {
      setLoading(true)
      setError(null)

      const { error: deleteError } = await supabase
        .from('reel_comments')
        .update({ is_deleted: true })
        .eq('id', commentId)
        .eq('user_id', user.id)

      if (deleteError) {
        throw deleteError
      }

      // Refresh comments
      await fetchComments()

      return { success: true, error: null }
    } catch (err) {
      console.error('Error deleting reel comment:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete comment'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }, [user, fetchComments])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  return {
    comments,
    loading,
    error,
    addComment,
    deleteComment,
    refresh: fetchComments
  }
}
