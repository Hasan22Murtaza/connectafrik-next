import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { notificationService } from '@/shared/services/notificationService'

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
  }
  media_urls: string[] | null
  likes_count: number
  comments_count: number
  shares_count: number
  views_count: number
  language?: string
  created_at: string
  isLiked?: boolean
}

export const usePosts = (category?: string) => {
  const { user } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPosts()
  }, [category, user?.id])

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
            country
          )
        `)
        .order('created_at', { ascending: false })

      if (category && category !== 'all') {
        query = query.eq('category', category)
      }

      const { data: postsData, error: postsError } = await query

      if (postsError) throw postsError

      // Check which posts the current user has liked
      let likesData: any[] = []
      if (user) {
        const { data, error: likesError } = await supabase
          .from('likes')
          .select('post_id')
          .eq('user_id', user.id)
          .in('post_id', postsData?.map(p => p.id) || [])

        if (!likesError) {
          likesData = data || []
        }
      }

      const postsWithLikes = postsData?.map(post => ({
        ...post,
        isLiked: likesData.some(like => like.post_id === post.id)
      })) || []

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
    media_urls?: string[]
  }) => {
    try {
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('posts')
        .insert({
          ...postData,
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

      // Add the new post to the top of the list
      setPosts(prev => [{ ...data, isLiked: false }, ...prev])
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
            await notificationService.sendPostInteractionNotification(
              post.author_id,
              actorName,
              'like',
              postTitle
            )
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
    refetch: fetchPosts
  }
}