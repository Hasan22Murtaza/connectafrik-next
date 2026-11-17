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
  ReelStats,
} from '../types/reels'

export type UseReelsOptions = {
  enabled?: boolean
}

export const useReels = (
  filters: ReelFilters = {},
  sortOptions: ReelSortOptions = { field: 'created_at', order: 'desc' },
  options?: UseReelsOptions
) => {
  const enabled = options?.enabled !== false
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
      const feed = currentFilters?.feed
      const dedicatedFeed =
        feed === 'foryou'
          ? '/api/reels/foryou'
          : feed === 'following'
            ? '/api/reels/following'
            : feed === 'saved'
              ? '/api/reels/saved'
              : feed === 'liked'
                ? '/api/reels/liked'
                : feed === 'reposted'
                  ? '/api/reels/reposted'
                  : null
      const endpoint = dedicatedFeed ?? '/api/reels'
      const params: Record<string, string | number | boolean | undefined> = {
        limit: pageSize,
        page: pageNum,
        sort_field: sortField,
        sort_order: sortOrder,
      }
      // Dedicated feed routes do not need ?feed=; keep it for explore/mine on /api/reels
      if (feed && !dedicatedFeed) params.feed = feed
      if (currentFilters?.category) params.category = currentFilters.category
      if (currentFilters?.author_id && currentFilters?.feed !== 'mine') params.author_id = currentFilters.author_id
      if (currentFilters?.following_only && !dedicatedFeed) params.following = true
      if (currentFilters?.is_featured) params.is_featured = true
      if (currentFilters?.min_duration != null) params.min_duration = currentFilters.min_duration
      if (currentFilters?.max_duration != null) params.max_duration = currentFilters.max_duration
      if (currentFilters?.tags?.length) params.tags = currentFilters.tags.join(',')
      if (currentFilters?.search) params.search = currentFilters.search
      if (currentFilters?.country) params.country = currentFilters.country
      if (
        currentFilters?.lat != null &&
        currentFilters?.lng != null &&
        Number.isFinite(currentFilters.lat) &&
        Number.isFinite(currentFilters.lng)
      ) {
        params.lat = currentFilters.lat
        params.lng = currentFilters.lng
        if (currentFilters.radius_km != null && Number.isFinite(currentFilters.radius_km)) {
          params.radius_km = currentFilters.radius_km
        }
      }

      const res = await apiClient.get<{ data: Reel[] }>(endpoint, params)
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
    if (!enabled) return
    if (!loading && hasMore) {
      fetchReels(page + 1, true, filters, sortOptions)
    }
  }, [enabled, loading, hasMore, page, fetchReels, filters, sortOptions])

  const refresh = useCallback(() => {
    if (!enabled) return
    fetchReels(0, false, filters, sortOptions)
  }, [enabled, fetchReels, filters, sortOptions])

  useEffect(() => {
    if (!enabled) {
      setReels([])
      setLoading(false)
      setError(null)
      setHasMore(false)
      setPage(0)
      return
    }
    fetchReels(0, false, filters, sortOptions)
  }, [enabled, fetchReels, JSON.stringify(filters), JSON.stringify(sortOptions)])

  const removeReel = useCallback((reelId: string) => {
    setReels((prev) => prev.filter((r) => r.id !== reelId))
  }, [])

  const patchReel = useCallback((reelId: string, patch: Partial<Reel>) => {
    setReels((prev) => prev.map((r) => (r.id === reelId ? { ...r, ...patch } : r)))
  }, [])

  return {
    reels,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
    removeReel,
    patchReel,
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
    isReposted: false,
    isFollowing: false,
    hasViewed: false
  })

  const fetchReel = useCallback(async () => {
    if (!reelId) return

    try {
      setLoading(true)
      setError(null)

      const res = await apiClient.get<{ data: ReelWithInteractionState }>(`/api/reels/${reelId}`)
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

      const res = await apiClient.post<{ data: Reel }>('/api/reels', {
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

      const res = await apiClient.patch<{ data: Reel }>(`/api/reels/${reelId}`, {
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

      await apiClient.delete<{ success: boolean }>(`/api/reels/${reelId}`)
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

      const res = await apiClient.post<{ data: { liked: boolean; reaction_type: string | null } }>(
        `/api/reels/${reelId}/like`,
        { reaction_type: 'love' }
      )
      return { success: true, liked: !!res?.data?.liked, error: null }
    } catch (err) {
      console.error('Error toggling reel like:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to toggle like'
      setError(errorMessage)
      return { success: false, liked: false, error: errorMessage }
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

      const res = await apiClient.post<{ data: { saved: boolean } }>(`/api/reels/${reelId}/save`)
      return { success: true, saved: !!res?.data?.saved, error: null }
    } catch (err) {
      console.error('Error toggling reel save:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to toggle save'
      setError(errorMessage)
      return { success: false, saved: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }, [user, reelId])

  const toggleRepost = useCallback(async () => {
    if (!user) {
      throw new Error('User must be logged in to repost a reel')
    }

    try {
      setLoading(true)
      setError(null)

      await apiClient.post<{ data: { reposted: boolean } }>(`/api/reels/${reelId}/repost`)
      return { success: true, error: null }
    } catch (err) {
      console.error('Error toggling reel repost:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to toggle repost'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }, [user, reelId])

  const recordView = useCallback(async (viewDuration?: number, completionRate?: number) => {
    if (!user) return

    try {
      await apiClient.post(`/api/reels/${reelId}/view`, {
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

      await apiClient.post(`/api/reels/${reelId}/share`, { share_type: shareType, platform })
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
    toggleRepost,
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
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const pageSize = 20

  const fetchComments = useCallback(async (pageNum: number = 0, append: boolean = false) => {
    try {
      if (append) setLoadingMore(true)
      else setLoading(true)
      setError(null)

      const res = await apiClient.get<{ data: ReelComment[]; hasMore?: boolean }>(
        `/api/reels/${reelId}/comments`,
        { limit: pageSize, page: pageNum }
      )
      const next = res?.data ?? []
      setComments((prev) => (append ? [...prev, ...next] : next))
      setHasMore(Boolean(res?.hasMore ?? next.length === pageSize))
      setPage(pageNum)
    } catch (err) {
      console.error('Error fetching reel comments:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch comments')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [reelId])

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return
    void fetchComments(page + 1, true)
  }, [loading, loadingMore, hasMore, page, fetchComments])

  const addComment = useCallback(async (content: string, parentId?: string) => {
    if (!user) {
      throw new Error('User must be logged in to comment')
    }

    try {
      setLoading(true)
      setError(null)

      const res = await apiClient.post<{ data: ReelComment }>(`/api/reels/${reelId}/comments`, {
        content,
        parent_id: parentId
      })

      const data = res?.data ?? null
      if (data) {
        if (parentId) {
          setComments((prev) =>
            prev.map((c) =>
              c.id === parentId
                ? { ...c, replies: [...(c.replies || []), data], replies_count: (c.replies_count || 0) + 1 }
                : c
            )
          )
        } else {
          setComments((prev) => [...prev, { ...data, replies: [] }])
        }
      }
      return { data, error: null }
    } catch (err) {
      console.error('Error adding reel comment:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to add comment'
      setError(errorMessage)
      return { data: null, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }, [user, reelId])

  const deleteComment = useCallback(async (commentId: string) => {
    if (!user) {
      throw new Error('User must be logged in to delete a comment')
    }

    try {
      setLoading(true)
      setError(null)

      await apiClient.delete(`/api/reels/${reelId}/comments/${commentId}`)
      setComments((prev) =>
        prev
          .filter((c) => c.id !== commentId)
          .map((c) => ({
            ...c,
            replies: (c.replies || []).filter((r) => r.id !== commentId),
            replies_count:
              (c.replies || []).some((r) => r.id === commentId)
                ? Math.max(0, (c.replies_count || 0) - 1)
                : c.replies_count,
          }))
      )
      return { success: true, error: null }
    } catch (err) {
      console.error('Error deleting reel comment:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete comment'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }, [user, reelId])

  const toggleCommentLike = useCallback(async (commentId: string) => {
    if (!user) {
      throw new Error('User must be logged in to like a comment')
    }

    try {
      setError(null)
      const res = await apiClient.post<{ data: { liked: boolean } }>(`/api/reels/${reelId}/comments/${commentId}/like`)
      const liked = !!res?.data?.liked
      setComments((prev) =>
        prev.map((c) => {
          if (c.id === commentId) {
            return {
              ...c,
              likes_count: Math.max(0, (c.likes_count || 0) + (liked ? 1 : -1)),
            }
          }
          return {
            ...c,
            replies: (c.replies || []).map((r) =>
              r.id === commentId
                ? {
                    ...r,
                    likes_count: Math.max(0, (r.likes_count || 0) + (liked ? 1 : -1)),
                  }
                : r
            ),
          }
        })
      )
      return { liked, error: null }
    } catch (err) {
      console.error('Error toggling reel comment like:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to like comment'
      setError(errorMessage)
      return { liked: false, error: errorMessage }
    }
  }, [user, reelId])

  useEffect(() => {
    if (enabled) {
      void fetchComments(0, false)
    } else {
      setComments([])
      setPage(0)
      setHasMore(false)
    }
  }, [fetchComments, enabled])

  return {
    comments,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    addComment,
    deleteComment,
    toggleCommentLike,
    refresh: () => fetchComments(0, false),
  }
}

export const useReelStats = (enabled: boolean = true) => {
  const { user } = useAuth()
  const [stats, setStats] = useState<ReelStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    if (!enabled) return
    if (!user) {
      setStats(null)
      setLoading(false)
      setError(null)
      return
    }
    try {
      setLoading(true)
      setError(null)
      const res = await apiClient.get<{ data: ReelStats }>('/api/reels/analytics')
      setStats(res?.data ?? null)
    } catch (err) {
      console.error('Error fetching reel analytics:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch reel analytics')
    } finally {
      setLoading(false)
    }
  }, [enabled, user])

  useEffect(() => {
    void fetchStats()
  }, [fetchStats])

  return {
    stats,
    loading,
    error,
    refresh: fetchStats,
  }
}
