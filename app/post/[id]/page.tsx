'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api-client'
import toast from 'react-hot-toast'
import CommentsSection from '@/features/social/components/CommentsSection'
import { PostCard } from '@/features/social/components/PostCard'
import { useEmojiReaction } from '@/shared/hooks/useEmojiReaction'
import { PostCardShimmer } from '@/shared/components/ui/ShimmerLoaders'

interface Post {
  id: string
  title: string
  content: string
  category: string
  author_id: string
  created_at: string
  likes_count: number
  comments_count: number
  shares_count: number
  views_count: number
  media_urls: string[] | null
  author: {
    id: string
    username: string
    full_name: string
    avatar_url: string | null
    country: string | null
  }
  isLiked?: boolean
}

interface PostResponse {
  data: Post
}

interface ReactionResponse {
  action: 'added' | 'updated' | 'removed'
  reaction_type: string
}

const PostDetailPage: React.FC = () => {
  const params = useParams()
  const router = useRouter()
  const postId = params?.id as string
  const { user } = useAuth()
  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [isLiked, setIsLiked] = useState(false)
  const [showComments, setShowComments] = useState(false)

  const handleLikesCountChange = useCallback((_postId: string, delta: number) => {
    setPost(prev => prev ? { ...prev, likes_count: Math.max(0, prev.likes_count + delta) } : null)
  }, [])
  const handleEmojiReaction = useEmojiReaction({ onLikesCountChange: handleLikesCountChange })

  useEffect(() => {
    if (postId) {
      fetchPost()
    }
  }, [postId, user])

  const fetchPost = async () => {
    try {
      setLoading(true)

      const response = await apiClient.get<PostResponse>(`/api/posts/${postId}`)
      const postData = response.data

      if (!postData) {
        toast.error('Post not found')
        router.push('/feed')
        return
      }

      setPost(postData)
      setIsLiked(!!postData.isLiked)
    } catch (error: any) {
      console.error('Error fetching post:', error)
      toast.error('Failed to load post')
      router.push('/feed')
    } finally {
      setLoading(false)
    }
  }

  const handleLike = async () => {
    if (!user) {
      toast.error('Please sign in to like posts')
      return
    }

    try {
      const response = await apiClient.post<ReactionResponse>(
        `/api/posts/${postId}/reaction`,
        { reaction_type: 'like' }
      )

      setPost((prev) => {
        if (!prev) return null
        const nextLikes =
          response.action === 'added'
            ? prev.likes_count + 1
            : response.action === 'removed'
            ? Math.max(0, prev.likes_count - 1)
            : prev.likes_count
        return { ...prev, likes_count: nextLikes }
      })
      setIsLiked(response.action === 'removed' ? false : true)
    } catch (error: any) {
      console.error('Error toggling like:', error)
      toast.error('Failed to update like')
    }
  }

  const handleShare = async () => {
    if (!post) return

    const shareUrl = `${window.location.origin}/post/${post.id}`

    if (navigator.share) {
      try {
        await navigator.share({
          title: post.title || 'Check out this post',
          text: post.content.substring(0, 100),
          url: shareUrl,
        })
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          navigator.clipboard.writeText(shareUrl)
          toast.success('Link copied to clipboard!')
        }
      }
    } else {
      navigator.clipboard.writeText(shareUrl)
      toast.success('Link copied to clipboard!')
    }
  }

  const handleDelete = async () => {
    if (!user || !post || post.author_id !== user.id) return

    if (!confirm('Are you sure you want to delete this post?')) return

    try {
      await apiClient.delete(`/api/posts/${postId}`)

      toast.success('Post deleted')
      router.push('/feed')
    } catch (error: any) {
      console.error('Error deleting post:', error)
      toast.error('Failed to delete post')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto bg-white min-h-screen">
          <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4">
            <div className="w-9 h-9 rounded-full animate-shimmer bg-gray-200" />
            <div className="h-5 w-24 animate-shimmer rounded bg-gray-200" />
          </div>
          <div className="p-4">
            <PostCardShimmer />
          </div>
        </div>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Post not found</p>
          <button
            onClick={() => router.push('/feed')}
            className="btn-primary"
          >
            Back to Feed
          </button>
        </div>
      </div>
    )
  }

  const isAuthor = user?.id === post.author_id

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto bg-white min-h-screen">
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">Post</h1>
        </div>

        <div className="p-4">
          <PostCard
            post={post as Parameters<typeof PostCard>[0]['post']}
            onLike={handleLike}
            onComment={() => setShowComments(true)}
            onShare={handleShare}
            onDelete={isAuthor ? handleDelete : undefined}
            onEmojiReaction={handleEmojiReaction}
            isPostLiked={isLiked}
            disablePostClick
          />

          {showComments && (
            <div className="mt-4">
              <CommentsSection
                postId={postId}
                isOpen={showComments}
                onClose={() => setShowComments(false)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PostDetailPage
