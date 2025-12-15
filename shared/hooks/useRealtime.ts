import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export const useRealtimePosts = (onNewPost: (post: any) => void, onPostUpdate: (post: any) => void) => {
  useEffect(() => {
    const channel = supabase
      .channel('posts_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'posts'
        },
        (payload) => {
          onNewPost(payload.new)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'posts'
        },
        (payload) => {
          onPostUpdate(payload.new)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [onNewPost, onPostUpdate])
}

export const useRealtimeLikes = (onLikeChange: (like: any, event: 'INSERT' | 'DELETE') => void) => {
  useEffect(() => {
    const channel = supabase
      .channel('likes_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'likes'
        },
        (payload) => {
          onLikeChange(payload.new, 'INSERT')
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'likes'
        },
        (payload) => {
          onLikeChange(payload.old, 'DELETE')
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [onLikeChange])
}

export const useRealtimeComments = (postId: string, onNewComment: (comment: any) => void) => {
  useEffect(() => {
    const channel = supabase
      .channel(`comments_${postId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `post_id=eq.${postId}`
        },
        (payload) => {
          onNewComment(payload.new)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [postId, onNewComment])
}