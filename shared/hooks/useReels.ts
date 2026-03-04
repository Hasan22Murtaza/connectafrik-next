import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import {
  Reel,
  CreateReelData,
  UpdateReelData,
  ReelFilters,
  ReelSortOptions,
  ReelComment,
  ReelInteractionState,
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
      setLoading(true)
      setError(null)

      const sortField = currentSortOptions?.field || 'created_at'
      const sortOrder = currentSortOptions?.order || 'desc'
      const params: Record<string, string | number | boolean | undefined> = {
        limit: pageSize,
        page: pageNum,
        sort_field: sortField,
        sort_order: sortOrder,
      }
      if (currentFilters?.category) params.category = currentFilters.category
      if (currentFilters?.author_id) params.author_id = currentFilters.author_id
      if (currentFilters?.is_featured) params.is_featured = true
      if (currentFilters?.min_duration != null) params.min_duration = currentFilters.min_duration
      if (currentFilters?.max_duration != null) params.max_duration = currentFilters.max_duration
      if (currentFilters?.tags?.length) params.tags = currentFilters.tags.join(',')
      if (currentFilters?.search) params.search = currentFilters.search

      const res = await apiClient.get<{ data: Reel[] }>('/api/memories', params)
      const newReels = res?.data ?? []

      if (append) {
        setReels(prev => [...prev, ...newReels])
      } else {
        setReels(newReels)
      }

      setHasMore(newReels.length === pageSize)
      setPage(pageNum)
    } catch (err) {
      console.error('Error fetching reels:', err)
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

interface ReelWithInteractionState extends Reel {
  interaction_state?: ReelInteractionState
}

export const useReel = (reelId: string) => {
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

      const res = await apiClient.get<{ data: ReelWithInteractionState }>(`/api/memories/${reelId}`)
      const payload = res?.data
      if (payload) {
        setReel(payload)
        if (payload.interaction_state) {
          setInteractionState(payload.interaction_state)
        }
      }
    } catch (err) {
      console.error('Error fetching reel:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch reel')
    } finally {
      setLoading(false)
    }
  }, [reelId])

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

      const res = await apiClient.post<{ data: Reel }>('/api/memories', {
        ...reelData,
        aspect_ratio: reelData.aspect_ratio || '9:16',
        category: reelData.category || 'entertainment',
        tags: reelData.tags || [],
        is_public: reelData.is_public ?? true
      })

      const data = res?.data ?? null
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

export const useUpdateReel = () => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateReel = useCallback(async (reelId: string, updateData: UpdateReelData) => {
    if (!user) {
      throw new Error('User must be logged in to update a reel')
    }

    try {
      setLoading(true)
      setError(null)

      const res = await apiClient.patch<{ data: Reel }>(`/api/memories/${reelId}`, {
        ...updateData,
        updated_at: new Date().toISOString()
      })

      const data = res?.data ?? null
      return { data, error: null }
    } catch (err) {
      console.error('Error updating reel:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to update reel'
      setError(errorMessage)
      return { data: null, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }, [user])

  return {
    updateReel,
    loading,
    error
  }
}

export const useDeleteReel = () => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const deleteReel = useCallback(async (reelId: string) => {
    if (!user) {
      throw new Error('User must be logged in to delete a reel')
    }

    try {
      setLoading(true)
      setError(null)

      await apiClient.delete<{ success: boolean }>(`/api/memories/${reelId}`)
      return { success: true, error: null }
    } catch (err) {
      console.error('Error deleting reel:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete reel'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }, [user])

  return {
    deleteReel,
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

      await apiClient.post<{ data: { liked: boolean } }>(`/api/memories/${reelId}/like`)
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

      await apiClient.post<{ data: { saved: boolean } }>(`/api/memories/${reelId}/save`)
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
      await apiClient.post(`/api/memories/${reelId}/view`, {
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

      await apiClient.post(`/api/memories/${reelId}/share`, { share_type: shareType, platform })
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

export const useReelComments = (reelId: string, enabled: boolean = false) => {
  const { user } = useAuth()
  const [comments, setComments] = useState<ReelComment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchComments = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const res = await apiClient.get<{ data: ReelComment[] }>(`/api/memories/${reelId}/comments`)
      setComments(res?.data ?? [])
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

      const res = await apiClient.post<{ data: ReelComment }>(`/api/memories/${reelId}/comments`, {
        content,
        parent_id: parentId
      })

      const data = res?.data ?? null
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

      await apiClient.delete(`/api/memories/${reelId}/comments/${commentId}`)
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
  }, [user, reelId, fetchComments])

  useEffect(() => {
    if (enabled) {
      fetchComments()
    }
  }, [fetchComments, enabled])

  return {
    comments,
    loading,
    error,
    addComment,
    deleteComment,
    refresh: fetchComments
  }
}
