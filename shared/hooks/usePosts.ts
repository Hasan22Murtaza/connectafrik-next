import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { notificationService } from '@/shared/services/notificationService'
import { getMutualUserIds } from '@/features/social/services/followService'
import { canViewPost, canComment, canFollow } from '@/shared/utils/visibilityUtils'
import type { ProfileVisibilityLevel } from '@/shared/types'

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
  likes_count: number
  comments_count: number
  shares_count: number
  views_count: number
  language?: string
  created_at: string
  isLiked?: boolean
  /** Whether the current viewer can comment (based on author allow_comments). Set by usePosts for feed. */
  canComment?: boolean
  /** Whether the current viewer can follow the author (based on author allow_follows). Set by usePosts for feed. */
  canFollow?: boolean
}

export interface UsePostsOptions {
  /** When category is 'culture', filter by this subcategory slug (posts.tags contains this value). */
  cultureSubcategory?: string
  /** When category is 'politics', filter by this subcategory slug (posts.tags contains this value). */
  politicsSubcategory?: string
}

export const usePosts = (category?: string, options?: UsePostsOptions) => {
  const { user } = useAuth()
  const cultureSubcategory = options?.cultureSubcategory
  const politicsSubcategory = options?.politicsSubcategory
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPosts()
  }, [category, cultureSubcategory, politicsSubcategory, user?.id])

  const fetchPosts = async () => {
    try {
      setLoading(true)
      let query = supabase
        .from('posts')
        .select(`
          *,
          author:profiles!posts_author_id_fkey(
            id,
            username,
            full_name,
            avatar_url,
            country,
            post_visibility,
            allow_comments,
            allow_follows
          )
        `)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })

      if (category && category !== 'all') {
        query = query.eq('category', category)
      }

      if (category === 'culture' && cultureSubcategory) {
        query = query.contains('tags', [cultureSubcategory])
      }
      if (category === 'politics' && politicsSubcategory) {
        query = query.contains('tags', [politicsSubcategory])
      }

      const { data: postsData, error: postsError } = await query

      if (postsError) throw postsError

      const viewerId = user?.id ?? null
      const authorIds = [...new Set((postsData || []).map(p => p.author_id))]
      // Friends = mutual follow; used to show posts with post_visibility === 'friends' only to friends
      const mutualSet = viewerId ? await getMutualUserIds(viewerId, authorIds) : new Set<string>()

      const filtered = (postsData || []).filter(p => {
        const authorId = p.author_id
        const postVis = (p.author as any)?.post_visibility ?? 'public'
        const isFriend = mutualSet.has(authorId)
        return canViewPost(viewerId, authorId, postVis, isFriend)
      })

      let likesData: any[] = []
      if (user && filtered.length > 0) {
        const { data, error: likesError } = await supabase
          .from('likes')
          .select('post_id')
          .eq('user_id', user.id)
          .in('post_id', filtered.map(p => p.id))

        if (!likesError) {
          likesData = data || []
        }
      }

      const postsWithLikes = filtered.map(post => {
        const authorId = post.author_id
        const allowComments = (post.author as any)?.allow_comments ?? 'everyone'
        const allowFollows = (post.author as any)?.allow_follows ?? 'everyone'
        const isMutual = mutualSet.has(authorId)
        return {
          ...post,
          isLiked: likesData.some(like => like.post_id === post.id),
          canComment: canComment(viewerId, authorId, allowComments, isMutual),
          canFollow: canFollow(viewerId, authorId, allowFollows, isMutual),
        }
      })

      setPosts(postsWithLikes)
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const createPost = async (postData: {
    title: string
    content: string
    category: 'politics' | 'culture' | 'general'
    media_type: 'image' | 'video' | 'none'
    media_urls?: string[]
    tags?: string[]
  }) => {
    try {
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('posts')
        .insert({
          ...postData,
          tags: postData.tags ?? [],
          author_id: user.id
        })
        .select(`
          *,
          author:profiles!posts_author_id_fkey(
            id,
            username,
            full_name,
            avatar_url,
            country
          )
        `)
        .single()

      if (error) throw error

      setPosts(prev => [{ ...data, isLiked: false }, ...prev])

      try {
        const authorName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Someone'
        const postTitle = postData.title || postData.content.substring(0, 50) || 'a new post'

        const { data: followersData } = await supabase
          .from('follows')
          .select('follower_id')
          .eq('following_id', user.id)

        const { data: friendsData } = await supabase
          .from('friend_requests')
          .select('sender_id, receiver_id')
          .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
          .eq('status', 'accepted')

        const recipientIds = new Set<string>()

        if (followersData) {
          followersData.forEach(follow => {
            if (follow.follower_id !== user.id) {
              recipientIds.add(follow.follower_id)
            }
          })
        }

        if (friendsData) {
          friendsData.forEach(friend => {
            const friendId = friend.sender_id === user.id ? friend.receiver_id : friend.sender_id
            if (friendId && friendId !== user.id) {
              recipientIds.add(friendId)
            }
          })
        }

        const notificationPromises = Array.from(recipientIds).map(recipientId =>
          notificationService.sendNotification({
            user_id: recipientId,
            title: 'New Post',
            body: `${authorName} shared a new post: "${postTitle}"`,
            notification_type: 'system',
            data: {
              type: 'new_post',
              post_id: data.id,
              author_id: user.id,
              author_name: authorName,
              url: `/post/${data.id}`
            }
          }).catch(() => ({ success: false }))
        )

        await Promise.allSettled(notificationPromises)
      } catch (notificationError) {
      }

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

      if (post.isLiked) {
        // Unlike the post
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('user_id', user.id)
          .eq('post_id', postId)

        if (error) throw error

        setPosts(prev => prev.map(p => 
          p.id === postId 
            ? { ...p, isLiked: false, likes_count: p.likes_count - 1 }
            : p
        ))
      } else {
        // Like the post
        const { error } = await supabase
          .from('likes')
          .insert({
            user_id: user.id,
            post_id: postId
          })

        if (error) throw error

        setPosts(prev => prev.map(p => 
          p.id === postId 
            ? { ...p, isLiked: true, likes_count: p.likes_count + 1 }
            : p
        ))

        // Send push notification to post author (if not the current user)
        if (post.author_id !== user.id) {
          try {
            const actorName = user.user_metadata?.full_name || user.email || 'Someone'
            const postTitle = post.title || post.content?.substring(0, 50) || 'your post'
            await notificationService.sendNotification({
              user_id: post.author_id,
              title: 'Post Interaction',
              body: `${actorName} liked your post${postTitle ? `: "${postTitle}"` : ''}`,
              notification_type: 'post_like',
              data: {
                post_id: postId,
                actor_id: user.id,
                actor_name: actorName,
                url: `/post/${postId}`
              }
            })
          } catch (notificationError) {
            // Don't fail the like if notification fails
          }
        }
      }
    } catch (error: any) {
      console.error('Error toggling like:', error.message)
    }
  }

  const sharePost = async (postId: string) => {
    try {
      // Import the shares service dynamically to avoid circular dependencies
      const { sharePost: sharePostService } = await import('@/features/social/services/sharesService')
      
      const result = await sharePostService(postId)
      
      if (result.success) {
        // Update the shares count locally (the trigger will handle the database update)
        setPosts(prev => prev.map(p => 
          p.id === postId 
            ? { ...p, shares_count: p.shares_count + 1 }
            : p
        ))
      }
      
      return result
    } catch (error) {
      console.error('Error sharing post:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Failed to share post' }
    }
  }

  const deletePost = async (postId: string) => {
    try {
      if (!user) throw new Error('User not authenticated')

      // Find the post to check if user is the author
      const post = posts.find(p => p.id === postId)
      if (!post) throw new Error('Post not found')
      
      if (post.author.id !== user.id) {
        throw new Error('You can only delete your own posts')
      }

      // Delete the post from the database
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId)
        .eq('author_id', user.id) // Double check for security

      if (error) throw error

      // Remove the post from local state
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

      // Record the view in the database
      const { error } = await supabase
        .from('post_views')
        .insert({
          post_id: postId,
          user_id: user.id
        })

      if (error) {
        // If it's a duplicate key error, that's fine - user already viewed
        if (error.code !== '23505') {
          console.error('Error recording post view:', error)
        }
        return
      }

      // Update local state
      setPosts(prev => prev.map(p => 
        p.id === postId 
          ? { ...p, views_count: p.views_count + 1 }
          : p
      ))

    } catch (error: any) {
      console.error('Error recording post view:', error)
    }
  }

  const updatePost = (postId: string, newContent: string) => {
    setPosts(prev => prev.map(p => 
      p.id === postId 
        ? { ...p, content: newContent, updated_at: new Date().toISOString() }
        : p
    ))
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
    error,
    createPost,
    toggleLike,
    sharePost,
    deletePost,
    updatePost,
    recordView,
    updatePostLikesCount,
    refetch: fetchPosts
  }
}