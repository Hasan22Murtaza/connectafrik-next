import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'

export interface GroupPost {
  id: string
  group_id: string
  author_id: string
  title: string
  content: string
  post_type: 'discussion' | 'goal_update' | 'announcement' | 'event' | 'resource'
  media_urls: string[] | null
  likes_count: number
  comments_count: number
  is_pinned: boolean
  is_deleted: boolean
  created_at: string
  updated_at: string
  author?: {
    id: string
    username: string
    full_name: string
    avatar_url: string | null
    country: string | null
  }
  isLiked?: boolean
}

export const useGroupPosts = (groupId: string) => {
  const { user } = useAuth()
  const [posts, setPosts] = useState<GroupPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (groupId) {
      fetchGroupPosts()
    }
  }, [groupId, user?.id])

  const fetchGroupPosts = async () => {
    try {
      setLoading(true)
      setError(null)

      const allPosts: GroupPost[] = []
      let page = 0
      let hasMore = true

      while (hasMore) {
        const res = await apiClient.get<{ data: GroupPost[]; hasMore?: boolean }>(
          `/api/groups/${groupId}/posts`,
          { page, limit: 10 }
        )
        const pagePosts = res.data || []
        allPosts.push(...pagePosts)
        hasMore = Boolean(res.hasMore)
        page += 1

        if (pagePosts.length === 0) break
      }

      setPosts(
        allPosts.map((p: GroupPost) => ({
          ...p,
          author: p.author ?? {
            id: p.author_id,
            username: 'Unknown',
            full_name: 'Unknown User',
            avatar_url: null,
            country: null
          },
          isLiked: p.isLiked ?? false
        }))
      )
    } catch (err: any) {
      console.error('Error fetching group posts:', err)
      setError(err.message)
      setPosts([])
    } finally {
      setLoading(false)
    }
  }

  const createGroupPost = async (postData: {
    title: string
    content: string
    post_type?: 'discussion' | 'goal_update' | 'announcement' | 'event' | 'resource'
    media_urls?: string[]
  }) => {
    if (!user) throw new Error('Must be logged in to create a post')

    try {
      const res = await apiClient.post<{ data: GroupPost }>(`/api/groups/${groupId}/posts`, {
        title: postData.title,
        content: postData.content,
        post_type: postData.post_type || 'discussion',
        media_urls: postData.media_urls || []
      })

      const newPost: GroupPost = {
        ...res.data,
        author: res.data.author ?? {
          id: user.id,
          username: 'Unknown',
          full_name: 'Unknown User',
          avatar_url: null,
          country: null
        },
        isLiked: false
      }

      setPosts(prev => [newPost, ...prev])
      toast.success('Post created successfully!')
      return newPost
    } catch (err: any) {
      console.error('Error creating group post:', err)
      toast.error(err.message || 'Failed to create post')
      throw err
    }
  }

  const toggleLike = async (postId: string) => {
    if (!user) {
      toast.error('You must be logged in to react to posts')
      return
    }

    const currentPost = posts.find(p => p.id === postId)
    const wasLiked = currentPost?.isLiked ?? false
    const prevCount = currentPost?.likes_count ?? 0

    setPosts(prev =>
      prev.map(post =>
        post.id === postId
          ? {
              ...post,
              likes_count: wasLiked ? Math.max(0, post.likes_count - 1) : post.likes_count + 1,
              isLiked: !wasLiked
            }
          : post
      )
    )

    try {
      const res = await apiClient.post<{ action: 'added' | 'updated' | 'removed'; reaction_type: string }>(
        `/api/groups/${groupId}/posts/${postId}/reactions`,
        { reaction_type: 'like' }
      )

      setPosts(prev =>
        prev.map(post =>
          post.id === postId
            ? {
                ...post,
                isLiked: res.action === 'removed' ? false : true,
                likes_count:
                  res.action === 'added'
                    ? post.likes_count + 1
                    : res.action === 'removed'
                    ? Math.max(0, post.likes_count - 1)
                    : post.likes_count,
              }
            : post
        )
      )

      window.dispatchEvent(new CustomEvent('group-reaction-updated', { detail: { postId } }))
    } catch (err: any) {
      setPosts(prev =>
        prev.map(post =>
          post.id === postId ? { ...post, isLiked: wasLiked, likes_count: prevCount } : post
        )
      )
      console.error('Error toggling reaction:', err)
      toast.error('Failed to update reaction')
    }
  }

  const deletePost = async (postId: string) => {
    if (!user) return

    try {
      await apiClient.delete(`/api/groups/${groupId}/posts/${postId}`)

      setPosts(prev => prev.filter(post => post.id !== postId))
      toast.success('Post deleted successfully')
    } catch (err: any) {
      console.error('Error deleting post:', err)
      toast.error(err.message || 'Failed to delete post')
      throw err
    }
  }

  const updatePost = async (postId: string, updates: { title?: string; content?: string }) => {
    if (!user) return

    try {
      const res = await apiClient.patch<{ data: any }>(`/api/groups/${groupId}/posts/${postId}`, updates)

      setPosts(prev =>
        prev.map(post => (post.id === postId ? { ...post, ...res.data } : post))
      )

      toast.success('Post updated successfully')
    } catch (err: any) {
      console.error('Error updating post:', err)
      toast.error(err.message || 'Failed to update post')
      throw err
    }
  }

  return {
    posts,
    loading,
    error,
    createGroupPost,
    toggleLike,
    deletePost,
    updatePost,
    refetch: fetchGroupPosts
  }
}
