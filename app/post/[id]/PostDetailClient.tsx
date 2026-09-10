'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, X } from '@/shared/icons'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient, ApiError } from '@/lib/api-client'
import toast from 'react-hot-toast'
import { PostCard } from '@/features/social/components/PostCard'
import { PostTheaterMedia } from '@/features/social/components/PostTheaterMedia'
import ShareModal from '@/features/social/components/ShareModal'
import { useEmojiReaction } from '@/shared/hooks/useEmojiReaction'
import { useMembers } from '@/shared/hooks/useMembers'
import { sendNotification } from '@/shared/services/notificationService'
import { sharePost } from '@/features/social/services/sharesService'

type PostDetail = Parameters<typeof PostCard>[0]['post']

interface PostResponse {
  data: PostDetail
}

const hasPostMedia = (post: PostDetail | null) =>
  Boolean(post && !post.reposted_post && post.media_urls && post.media_urls.length > 0)

const TheaterSkeleton: React.FC = () => (
  <div className="flex h-full w-full flex-col md:flex-row bg-black">
    <div className="relative flex min-h-[42vh] flex-1 items-center justify-center bg-black md:min-h-0">
      <div className="h-10 w-10 absolute left-3 top-3 rounded-full animate-pulse bg-white/15" />
      <div className="h-[55%] w-[70%] max-w-3xl rounded-lg animate-pulse bg-white/10" />
    </div>
    <aside className="flex h-[58vh] w-full flex-col bg-surface p-4 md:h-full md:w-[380px] lg:w-[400px] xl:w-[420px]">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 shrink-0 rounded-full animate-shimmer bg-gray-200" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-40 rounded animate-shimmer bg-gray-200" />
          <div className="h-3 w-24 rounded animate-shimmer bg-gray-200" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-4 w-full rounded animate-shimmer bg-gray-200" />
        <div className="h-4 w-5/6 rounded animate-shimmer bg-gray-200" />
      </div>
      <div className="mt-4 flex gap-2">
        <div className="h-9 flex-1 rounded-lg animate-shimmer bg-gray-200" />
        <div className="h-9 flex-1 rounded-lg animate-shimmer bg-gray-200" />
        <div className="h-9 flex-1 rounded-lg animate-shimmer bg-gray-200" />
      </div>
      <div className="mt-4 space-y-3 border-t border-border-subtle pt-4">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="flex gap-2">
            <div className="h-8 w-8 shrink-0 rounded-full animate-shimmer bg-gray-200" />
            <div className="h-12 flex-1 rounded-2xl animate-shimmer bg-gray-200" />
          </div>
        ))}
      </div>
    </aside>
  </div>
)

const PostDetailPage: React.FC = () => {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const postId = params?.id as string
  const highlightCommentId = searchParams.get('comment')
  const { user } = useAuth()
  const { members } = useMembers()
  const [post, setPost] = useState<PostDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<'not_found' | 'failed' | null>(null)
  const [shareOpen, setShareOpen] = useState(false)

  const handleLikesCountChange = useCallback((_id: string, delta: number) => {
    setPost((prev) =>
      prev ? { ...prev, likes_count: Math.max(0, prev.likes_count + delta) } : null
    )
  }, [])
  const handleEmojiReaction = useEmojiReaction({ onLikesCountChange: handleLikesCountChange })

  const fetchPost = useCallback(async () => {
    if (!postId) return
    try {
      setLoading(true)
      setError(null)

      const response = await apiClient.get<PostResponse>(`/api/posts/${postId}`)
      const postData = response.data

      if (!postData) {
        setPost(null)
        setError('not_found')
        return
      }

      setPost(postData)
    } catch (err: unknown) {
      console.error('Error fetching post:', err)
      setPost(null)
      if (err instanceof ApiError && err.status === 404) {
        setError('not_found')
      } else {
        setError('failed')
      }
    } finally {
      setLoading(false)
    }
  }, [postId])

  useEffect(() => {
    void fetchPost()
  }, [fetchPost, user?.id])

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push('/feed')
    }
  }

  const handleLike = async (id: string) => {
    if (!user) {
      toast.error('Please sign in to like posts')
      return
    }

    const previous = post
    setPost((prev) => {
      if (!prev) return null
      const wasLiked = !!prev.isLiked
      return {
        ...prev,
        isLiked: !wasLiked,
        likes_count: Math.max(0, prev.likes_count + (wasLiked ? -1 : 1)),
      }
    })

    try {
      const response = await apiClient.post<{ action: 'added' | 'updated' | 'removed' }>(
        `/api/posts/${id}/reaction`,
        { reaction_type: 'like' }
      )
      setPost((prev) => {
        if (!prev) return null
        return {
          ...prev,
          isLiked: response.action === 'removed' ? false : true,
        }
      })
    } catch (err) {
      console.error('Error toggling like:', err)
      setPost(previous)
      toast.error('Failed to update like')
    }
  }

  const handleShare = () => {
    setShareOpen(true)
  }

  const handleShared = async () => {
    if (!post) return
    const result = await sharePost(post.id)
    if (result.success) {
      setPost((prev) =>
        prev
          ? { ...prev, isShare: true, shares_count: (prev.shares_count || 0) + 1 }
          : null
      )
    }
  }

  const handleSendToMembers = async (memberIds: string[], message: string) => {
    if (!memberIds.length || !post) return

    const senderName = user?.user_metadata?.full_name || user?.email || 'Someone'
    const results = await Promise.allSettled(
      memberIds.map((memberId) =>
        sendNotification({
          user_id: memberId,
          title: 'Post Shared With You',
          body: message
            ? `${senderName} shared a post with you: "${message}"`
            : `${senderName} shared a post with you`,
          notification_type: 'post_share',
          data: {
            type: 'post_share',
            post_id: post.id,
            sender_id: user?.id || '',
            sender_name: senderName,
            message,
            url: `/post/${post.id}`,
          },
        })
      )
    )

    const succeeded = results.filter((r) => r.status === 'fulfilled' && r.value.success).length
    if (succeeded > 0) {
      toast.success(`Shared with ${succeeded} member${succeeded === 1 ? '' : 's'}`)
    } else {
      toast.error('Failed to send notifications')
    }
  }

  const handleDelete = async (id: string) => {
    if (!user || !post || post.author_id !== user.id) return

    try {
      await apiClient.delete(`/api/posts/${id}`)
      toast.success('Post deleted')
      router.push('/feed')
    } catch (err) {
      console.error('Error deleting post:', err)
      toast.error('Failed to delete post')
    }
  }

  const handleEdit = (
    id: string,
    updates: {
      content: string
      category: 'politics' | 'culture' | 'general'
      media_urls?: string[]
      media_type?: string
      tags?: string[]
      background_id?: string | null
    }
  ) => {
    setPost((prev) => (prev && prev.id === id ? { ...prev, ...updates } : prev))
  }

  const shareUrl = useMemo(() => {
    if (!post) return ''
    if (typeof window === 'undefined') return `/post/${post.id}`
    return `${window.location.origin}/post/${post.id}`
  }, [post])

  const shareMembers = useMemo(
    () => members.map((member) => ({ id: member.id, name: member.name, avatar_url: member.avatar_url })),
    [members]
  )

  const isAuthor = Boolean(user && post && post.author_id === user.id)
  const theater = hasPostMedia(post)

  const postCard = post && post.author ? (
    <PostCard
      post={post}
      onLike={handleLike}
      onComment={() => undefined}
      onShare={handleShare}
      onDelete={isAuthor ? handleDelete : undefined}
      onEdit={isAuthor ? handleEdit : undefined}
      onEmojiReaction={handleEmojiReaction}
      isPostLiked={!!post.isLiked}
      canComment={post.canComment ?? true}
      canFollow={post.canFollow ?? true}
      disablePostClick
      variant={theater ? 'theater' : 'detail'}
      hideMedia={theater}
      highlightCommentId={highlightCommentId}
    />
  ) : null

  return (
    <div className="h-[calc(100dvh-7rem)] sm:h-[calc(100dvh-7.5rem)] md:h-[calc(100dvh-4rem)] overflow-hidden bg-black">
      {loading ? (
        <TheaterSkeleton />
      ) : error || !post || !post.author ? (
        <div className="flex h-full items-center justify-center px-4">
          <div className="w-full max-w-md rounded-2xl bg-surface px-6 py-12 text-center">
            <button
              type="button"
              onClick={handleBack}
              className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-surface-secondary"
              aria-label="Go back"
            >
              <X className="h-5 w-5 text-content" />
            </button>
            <p className="text-content font-semibold mb-1">
              {error === 'failed' ? "Couldn't load this post" : "This post isn't available"}
            </p>
            <p className="text-sm text-content-secondary mb-6">
              {error === 'failed'
                ? 'Check your connection and try again.'
                : 'It may have been deleted, or the link may be incorrect.'}
            </p>
            <div className="flex items-center justify-center gap-3">
              {error === 'failed' && (
                <button type="button" onClick={() => void fetchPost()} className="btn-primary">
                  Try again
                </button>
              )}
              <button
                type="button"
                onClick={() => router.push('/feed')}
                className={error === 'failed' ? 'px-4 py-2 text-sm font-medium text-content-secondary hover:underline' : 'btn-primary'}
              >
                Back to Feed
              </button>
            </div>
          </div>
        </div>
      ) : theater ? (
        <div className="flex h-full w-full flex-col md:flex-row">
          <section className="relative min-h-[42vh] flex-1 bg-black md:min-h-0">
            <PostTheaterMedia
              urls={post.media_urls || []}
              onClose={handleBack}
            />
          </section>
          <aside className="flex h-[58vh] w-full min-h-0 shrink-0 flex-col overflow-hidden border-t border-border md:border-t-0 md:border-l md:h-full md:w-[380px] lg:w-[400px] xl:w-[420px] bg-surface">
            {postCard}
          </aside>
        </div>
      ) : (
        <div className="flex h-full flex-col bg-black">
          <div className="flex items-center gap-3 px-3 py-2.5 text-white">
            <button
              type="button"
              onClick={handleBack}
              className="rounded-full p-2 hover:bg-white/10 transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-semibold">Post</h1>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-xl bg-surface min-h-full">
              {postCard}
            </div>
          </div>
        </div>
      )}

      {post && (
        <ShareModal
          isOpen={shareOpen}
          onClose={() => setShareOpen(false)}
          postUrl={shareUrl}
          postId={post.id}
          members={shareMembers}
          onSendToMembers={handleSendToMembers}
          onShared={() => {
            void handleShared()
          }}
        />
      )}
    </div>
  )
}

export default PostDetailPage
