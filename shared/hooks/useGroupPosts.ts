import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
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

      // Fetch posts with comment count
      const { data: postsData, error: postsError } = await supabase
        .from('group_posts')
        .select('*, group_post_comments(count)')
        .eq('group_id', groupId)
        .eq('is_deleted', false)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })

      if (postsError) throw postsError

      if (!postsData || postsData.length === 0) {
        setPosts([])
        setLoading(false)
        return
      }

      // Fetch author profiles
      const authorIds = [...new Set(postsData.map(p => p.author_id))]
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, country')
        .in('id', authorIds)

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError)
      }

      // Create a map of author profiles
      const profilesMap = new Map(
        (profilesData || []).map(profile => [profile.id, profile])
      )

      // Check which posts the current user has reacted to (using group_post_reactions table)
      let reactionsData: any[] = []
      if (user) {
        const { data, error: reactionsError } = await supabase
          .from('group_post_reactions')
          .select('group_post_id')
          .eq('user_id', user.id)
          .in('group_post_id', postsData.map(p => p.id))

        if (!reactionsError) {
          reactionsData = data || []
        }
      }

      // Combine posts with author profiles and real comment count
      const postsWithAuthors = postsData.map(post => {
        const realCommentCount = Array.isArray((post as any).group_post_comments) && (post as any).group_post_comments.length > 0
          ? (post as any).group_post_comments[0].count
          : post.comments_count
        return {
          ...post,
          comments_count: realCommentCount,
          author: profilesMap.get(post.author_id) || {
            id: post.author_id,
            username: 'Unknown',
            full_name: 'Unknown User',
            avatar_url: null,
            country: null
          },
          isLiked: reactionsData.some(r => r.group_post_id === post.id)
        }
      })

      setPosts(postsWithAuthors)
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
      const { data, error } = await supabase
        .from('group_posts')
        .insert([
          {
            group_id: groupId,
            author_id: user.id,
            title: postData.title,
            content: postData.content,
            post_type: postData.post_type || 'discussion',
            media_urls: postData.media_urls || [],
            likes_count: 0,
            comments_count: 0,
            is_pinned: false,
            is_deleted: false
          }
        ])
        .select('*')
        .single()

      if (error) throw error

      // Fetch author profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, country')
        .eq('id', user.id)
        .single()

      const newPost: GroupPost = {
        ...data,
        author: profileData || {
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
    // Legacy toggle - now handled via onEmojiReaction in group pages
    // Kept for backward compatibility, defaults to 'like' reaction type
    if (!user) {
      toast.error('You must be logged in to react to posts')
      return
    }

    try {
      // Check if user already has a reaction for this post
      const { data: existingReaction, error: checkError } = await supabase
        .from('group_post_reactions')
        .select('id, reaction_type')
        .eq('group_post_id', postId)
        .eq('user_id', user.id)
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError
      }

      if (existingReaction) {
        // Remove reaction
        const { error } = await supabase
          .from('group_post_reactions')
          .delete()
          .eq('id', existingReaction.id)

        if (error) throw error

        // Update likes_count in group_posts table
        const currentPost = posts.find(p => p.id === postId)
        if (currentPost) {
          await supabase
            .from('group_posts')
            .update({ likes_count: Math.max(0, currentPost.likes_count - 1) })
            .eq('id', postId)
        }

        // Update local state
        setPosts(prev => prev.map(post => {
          if (post.id === postId) {
            return {
              ...post,
              likes_count: Math.max(0, post.likes_count - 1),
              isLiked: false
            }
          }
          return post
        }))

        window.dispatchEvent(new CustomEvent('group-reaction-updated', { detail: { postId } }))
      } else {
        // Insert 'like' reaction
        const { error } = await supabase
          .from('group_post_reactions')
          .insert([
            {
              group_post_id: postId,
              user_id: user.id,
              reaction_type: 'like'
            }
          ])

        if (error) throw error

        // Update likes_count in group_posts table
        const currentPost = posts.find(p => p.id === postId)
        if (currentPost) {
          await supabase
            .from('group_posts')
            .update({ likes_count: (currentPost.likes_count || 0) + 1 })
            .eq('id', postId)
        }

        // Update local state
        setPosts(prev => prev.map(post => {
          if (post.id === postId) {
            return {
              ...post,
              likes_count: post.likes_count + 1,
              isLiked: true
            }
          }
          return post
        }))

        window.dispatchEvent(new CustomEvent('group-reaction-updated', { detail: { postId } }))
      }
    } catch (err: any) {
      console.error('Error toggling reaction:', err)
      toast.error('Failed to update reaction')
    }
  }

  const deletePost = async (postId: string) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('group_posts')
        .update({ is_deleted: true })
        .eq('id', postId)
        .eq('author_id', user.id) // Only allow author to delete

      if (error) throw error

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
      const { error } = await supabase
        .from('group_posts')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', postId)
        .eq('author_id', user.id) // Only allow author to update

      if (error) throw error

      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          return { ...post, ...updates }
        }
        return post
      }))

      toast.success('Post updated successfully')
    } catch (err: any) {
      console.error('Error updating post:', err)
      toast.error(err.message || 'Failed to update post')
      throw err
    }
  }

  const recordView = async (postId: string) => {
    // You can implement view tracking here if needed
    // For now, we'll just log it
    console.log('Post viewed:', postId)
  }

  return {
    posts,
    loading,
    error,
    createGroupPost,
    toggleLike,
    deletePost,
    updatePost,
    recordView,
    refetch: fetchGroupPosts
  }
}

