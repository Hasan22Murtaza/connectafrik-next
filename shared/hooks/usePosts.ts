import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api-client'
import type { ProfileVisibilityLevel } from '@/shared/types'

const PAGE_SIZE = 10

export interface Post {
  id: string
  title: string
  content: string
  category: 'politics' | 'culture' | 'general'
  author_id: string
  author: {
    id: string
    username: string
    full_name: string
    avatar_url: string | null
    country: string | null
    creator_type?: string
    location?: string
    post_visibility?: ProfileVisibilityLevel
    allow_comments?: ProfileVisibilityLevel
    allow_follows?: ProfileVisibilityLevel
  }
  media_urls: string[] | null
  tags?: string[] | null
  location?: string | null
  likes_count: number
  comments_count: number
  shares_count: number
  views_count: number
  language?: string
  created_at: string
  isLiked?: boolean
  canComment?: boolean
  canFollow?: boolean
}

export interface UsePostsOptions {
  cultureSubcategory?: string
  politicsSubcategory?: string
}

interface PostsListResponse {
  data: Post[]
  page: number
  pageSize: number
  hasMore: boolean
}

interface SinglePostResponse {
  data: Post
}

interface LikeResponse {
  liked: boolean
  likes_count: number
}

interface ShareResponse {
  success: boolean
  error?: string
}

export const usePosts = (category?: string, options?: UsePostsOptions) => {
  const { user } = useAuth()
  const cultureSubcategory = options?.cultureSubcategory
  const politicsSubcategory = options?.politicsSubcategory
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const pageRef = useRef(0)

  const fetchPosts = useCallback(async (pageNum: number = 0, append: boolean = false) => {
    try {
      if (append) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }

      const params: Record<string, string | number | boolean | undefined> = {
        page: pageNum,
      }

      if (category && category !== 'all') {
        params.category = category
      }

      const subcategory =
        category === 'culture' ? cultureSubcategory :
        category === 'politics' ? politicsSubcategory :
        undefined

      if (subcategory) {
        params.subcategory = subcategory
      }

      const response = await apiClient.get<PostsListResponse>('/api/posts', params)

      if (append) {
        setPosts(prev => [...prev, ...response.data])
      } else {
        setPosts(response.data)
      }

      setHasMore(response.hasMore)
      pageRef.current = pageNum
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [category, cultureSubcategory, politicsSubcategory, user?.id])

  useEffect(() => {
    pageRef.current = 0
    setHasMore(true)
    fetchPosts(0, false)
  }, [fetchPosts])

  const loadMore = useCallback(() => {
    if (!loading && !loadingMore && hasMore) {
      fetchPosts(pageRef.current + 1, true)
    }
  }, [loading, loadingMore, hasMore, fetchPosts])

  const createPost = async (postData: {
    title: string
    content: string
    category: 'politics' | 'culture' | 'general'
    media_type: 'image' | 'video' | 'none'
    media_urls?: string[]
    tags?: string[]
    location?: string
  }) => {
    try {
      if (!user) throw new Error('User not authenticated')

      const response = await apiClient.post<SinglePostResponse>('/api/posts', postData)

      setPosts(prev => [{ ...response.data, isLiked: false }, ...prev])

      return { error: null }
    } catch (error: any) {
      return { error: error.message }
    }
  }

  const toggleLike = async (postId: string) => {
    try {
      if (!user) throw new Error('User not authenticated')

      const post = posts.find(p => p.id === postId)
      if (!post) return

      // Optimistic update
      const wasLiked = post.isLiked
      setPosts(prev => prev.map(p =>
        p.id === postId
          ? { ...p, isLiked: !wasLiked, likes_count: wasLiked ? p.likes_count - 1 : p.likes_count + 1 }
          : p
      ))

      const response = await apiClient.post<LikeResponse>(`/api/posts/${postId}/like`)

      // Reconcile with server state
      setPosts(prev => prev.map(p =>
        p.id === postId
          ? { ...p, isLiked: response.liked, likes_count: response.likes_count }
          : p
      ))
    } catch (error: any) {
      // Revert optimistic update on failure
      const post = posts.find(p => p.id === postId)
      if (post) {
        setPosts(prev => prev.map(p =>
          p.id === postId
            ? { ...p, isLiked: post.isLiked, likes_count: post.likes_count }
            : p
        ))
      }
      console.error('Error toggling like:', error.message)
    }
  }

  const sharePost = async (postId: string) => {
    try {
      const response = await apiClient.post<ShareResponse>(`/api/posts/${postId}/share`)
      if (response.success) {
        setPosts(prev => prev.map(p =>
          p.id === postId
            ? { ...p, shares_count: p.shares_count + 1 }
            : p
        ))
      }
      return response
    } catch (error) {
      console.error('Error sharing post:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Failed to share post' }
    }
  }

  const deletePost = async (postId: string) => {
    try {
      if (!user) throw new Error('User not authenticated')

      const post = posts.find(p => p.id === postId)
      if (!post) throw new Error('Post not found')

      if (post.author.id !== user.id) {
        throw new Error('You can only delete your own posts')
      }

      await apiClient.delete(`/api/posts/${postId}`)

      setPosts(prev => prev.filter(p => p.id !== postId))

      return { success: true }
    } catch (error: any) {
      console.error('Error deleting post:', error)
      return { success: false, error: error.message }
    }
  }

  const recordView = async (postId: string) => {
    try {
      if (!user) return

      await apiClient.post(`/api/posts/${postId}/view`)

      setPosts(prev => prev.map(p =>
        p.id === postId
          ? { ...p, views_count: p.views_count + 1 }
          : p
      ))
    } catch (error: any) {
      console.error('Error recording post view:', error)
    }
  }

  const updatePost = (postId: string, updates: string | { title?: string; content?: string; category?: 'politics' | 'culture' | 'general'; media_urls?: string[]; media_type?: string; tags?: string[]; location?: string }) => {
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p
      if (typeof updates === 'string') {
        return { ...p, content: updates, updated_at: new Date().toISOString() }
      }
      return { ...p, ...updates, updated_at: new Date().toISOString() } as typeof p
    }))
  }

  const updatePostLikesCount = (postId: string, delta: number) => {
    setPosts(prev => prev.map(p =>
      p.id === postId
        ? { ...p, likes_count: Math.max(0, (p.likes_count || 0) + delta) }
        : p
    ))
  }

  return {
    posts,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    createPost,
    toggleLike,
    sharePost,
    deletePost,
    updatePost,
    recordView,
    updatePostLikesCount,
    refetch: () => { pageRef.current = 0; setHasMore(true); fetchPosts(0, false) }
  }
}
