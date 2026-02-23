'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Globe, TrendingUp, Users, Sparkles } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/shared/hooks/useProfile'
import { usePosts } from '@/shared/hooks/usePosts'
import { useMembers } from '@/shared/hooks/useMembers'
import FeedLayout from '@/shared/components/layout/FeedLayout'
import Advertisement from '@/shared/components/ui/Advertisement'
import { StoriesBar } from '@/features/social/components/story'
import CreatePost from '@/features/social/components/CreatePost'
import { PostCard } from '@/features/social/components/PostCard'
import ShareModal from '@/features/social/components/ShareModal'
import { updateEngagementReward } from '@/features/social/services/fairnessRankingService'
import { trackEvent } from '@/features/social/services/engagementTracking'
import { sendNotification } from '@/shared/services/notificationService'
import toast from 'react-hot-toast'
import { useEmojiReaction } from '@/shared/hooks/useEmojiReaction'

const FEED_CATEGORIES = [
  { id: 'all' as const, label: 'All Posts', icon: Globe },
  { id: 'politics' as const, label: 'Politics', icon: TrendingUp },
  { id: 'culture' as const, label: 'Culture', icon: Users },
]

type CategoryFilter = typeof FEED_CATEGORIES[number]['id'] | 'general'

const FeedPage: React.FC = () => {
  const { user } = useAuth()
  const { profile } = useProfile()
  const [searchTerm, setSearchTerm] = useState('')
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all')
  const [shareModalState, setShareModalState] = useState<{ open: boolean; postId: string | null }>({ open: false, postId: null })
  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const [explorationBoost, setExplorationBoost] = useState(false)

  const { posts, loading, loadingMore, hasMore, loadMore, createPost, toggleLike, deletePost, updatePost, recordView, updatePostLikesCount } = usePosts(activeCategory)
  const { members } = useMembers()
  const handleEmojiReaction = useEmojiReaction({ onLikesCountChange: updatePostLikesCount, trackEngagement: true })

  // Infinite scroll observer
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const sentinel = loadMoreRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          loadMore()
        }
      },
      { rootMargin: '300px' }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loading, loadingMore, loadMore])

  // Posts are already sorted by created_at DESC from the database
  const filteredPosts = useMemo(() => {
    if (!searchTerm.trim()) return posts
    const term = searchTerm.toLowerCase()
    return posts.filter((post) =>
      post.title.toLowerCase().includes(term) ||
      post.content.toLowerCase().includes(term) ||
      post.author?.full_name?.toLowerCase().includes(term) ||
      post.author?.username?.toLowerCase().includes(term)
    )
  }, [posts, searchTerm])

  const memoizedMembers = useMemo(() => members, [members])

  const handleCreatePost = useCallback(async (postData: {
    title: string
    content: string
    category: 'politics' | 'culture' | 'general'
    media_type: 'image' | 'video' | 'none'
    media_urls?: string[]
    location?: string
  }) => {
    const { error } = await createPost(postData)
    if (error) {
      toast.error(error)
    } else {
      toast.success('Post created successfully!')
      setIsComposerOpen(false)
    }
  }, [createPost])

  const handleToggleLike = useCallback(async (postId: string) => {
    const post = posts.find(p => p.id === postId)
    if (post?.author_id) {
      updateEngagementReward(post.author_id, 'like')
    }
    await toggleLike(postId)

    // Track engagement event
    if (user?.id) {
      trackEvent.like(user.id, postId)
    }
  }, [posts, toggleLike, user?.id])

  const handleComment = useCallback((postId: string) => {
    const post = posts.find(p => p.id === postId)
    if (post?.author_id) {
      updateEngagementReward(post.author_id, 'comment')
    }
    if (user?.id) {
      trackEvent.comment(user.id, postId)
    }
  }, [posts, user?.id])

  const handleShare = useCallback((postId: string) => {
    const post = posts.find(p => p.id === postId)
    if (post?.author_id) {
      updateEngagementReward(post.author_id, 'share')
    }
    setShareModalState({ open: true, postId })

    if (user?.id) {
      trackEvent.share(user.id, postId)
    }
  }, [posts, user?.id])

  const handleDelete = useCallback(async (postId: string) => {
    try {
      const result = await deletePost(postId)
      if (result.success) {
        toast.success('Post deleted successfully')
      } else {
        toast.error(result.error || 'Failed to delete post')
      }
    } catch (error: any) {
      console.error('Error deleting post:', error)
      toast.error('Failed to delete post')
    }
  }, [deletePost])

  const handleEdit = useCallback((postId: string, updates: { title: string; content: string; category: 'politics' | 'culture' | 'general'; media_urls?: string[]; media_type?: string; tags?: string[] }) => {
    updatePost(postId, updates)
  }, [updatePost])

  const handleSendToMembers = useCallback(async (memberIds: string[], message: string) => {
    if (!memberIds.length) {
      toast.success('No members selected')
      return
    }

    const senderName = user?.user_metadata?.full_name || user?.email || 'Someone'
    const postId = shareModalState.postId

    // Send FCM notification to each selected member
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
            post_id: postId || '',
            sender_id: user?.id || '',
            sender_name: senderName,
            message,
            url: `/post/${postId}`,
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
  }, [user?.id, shareModalState.postId])





  const activeSharePost = useMemo(() => (
    shareModalState.postId ? posts.find((post) => post.id === shareModalState.postId) : null
  ), [posts, shareModalState.postId])

  const shareUrl = useMemo(() => {
    if (!shareModalState.postId) return ''
    if (typeof window === 'undefined') return `/post/${shareModalState.postId}`
    return `${process.env.NEXT_PUBLIC_APP_URL}/post/${shareModalState.postId}`
  }, [shareModalState.postId])

  const renderPosts = () => {
    if (loading) {
      return (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="animate-pulse rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 rounded bg-gray-200" />
                  <div className="h-3 w-1/2 rounded bg-gray-200" />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-3 w-full rounded bg-gray-200" />
                <div className="h-3 w-5/6 rounded bg-gray-200" />
                <div className="h-3 w-4/6 rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      )
    }

    if (!filteredPosts.length) {
      return (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-600">
          No posts yet. Start the conversation by sharing your first post!
        </div>
      )
    }

    return (
      <div className="space-y-2 sm:space-y-3">
        {filteredPosts.map((post) => (
          <PostCard
              key={post.id}
              post={post}
              onLike={handleToggleLike}
              onComment={handleComment}
              onShare={handleShare}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onView={recordView}
              onEmojiReaction={handleEmojiReaction}
              isPostLiked={post.isLiked}
              canComment={post.canComment}
              canFollow={post.canFollow}
            />
        ))}

        {/* Infinite scroll sentinel */}
        <div ref={loadMoreRef} className="h-1" />

        {/* Shimmer loading skeleton for more posts */}
        {loadingMore && (
          <div className="space-y-2 sm:space-y-2">
            {Array.from({ length: 2 }).map((_, idx) => (
              <div key={idx} className="animate-pulse rounded-2xl border border-gray-200 bg-white p-2">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-full bg-gray-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/3 rounded bg-gray-200" />
                    <div className="h-3 w-1/4 rounded bg-gray-200" />
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="h-3 w-full rounded bg-gray-200" />
                  <div className="h-3 w-5/6 rounded bg-gray-200" />
                  <div className="h-3 w-4/6 rounded bg-gray-200" />
                </div>
                <div className="mt-4 flex items-center space-x-6">
                  <div className="h-3 w-12 rounded bg-gray-200" />
                  <div className="h-3 w-12 rounded bg-gray-200" />
                  <div className="h-3 w-12 rounded bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* End of feed message — only show if more than one page was loaded */}
        {!hasMore && filteredPosts.length >= 10 && (
          <div className="py-6 text-center text-sm text-gray-400">
            You&apos;ve reached the end of the feed
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 max-w-full 2xl:max-w-screen-2xl mx-auto ">

      <FeedLayout>
        <div className="w-full space-y-3 sm:space-y-4">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-r from-orange-100 to-green-100">
            <Advertisement type="banner" placement="feed-top" className="rounded-none" />
          </div>

          <StoriesBar />


          <section>
            {!user ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                Sign in to share your thoughts with the community.
              </div>
            ) : isComposerOpen ? (
              <CreatePost
                onSubmit={handleCreatePost}
                onCancel={() => setIsComposerOpen(false)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setIsComposerOpen(true)}
                className="flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 text-left shadow-sm transition-all hover:shadow hover:border-gray-200"
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.full_name} className="h-10 w-10 rounded-full object-cover shrink-0" />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-white font-semibold text-sm shrink-0">
                    {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                )}
                <div className="flex-1 min-w-0 rounded-full bg-gray-100 px-4 py-2.5">
                  <p className="text-sm sm:text-base text-gray-500">What&apos;s on your mind, {profile?.full_name?.split(' ')[0] || 'there'}?</p>
                </div>
              </button>
            )}
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">Browse by category</h2>
              <button
                type="button"
                onClick={() => {
                  setExplorationBoost(!explorationBoost)
                  toast.success(explorationBoost ? 'Back to balanced feed' : 'Discovering new voices!')
                }}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  explorationBoost
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-primary-200 hover:text-[#f97316]'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {explorationBoost ? 'Exploring...' : 'Discover More'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {FEED_CATEGORIES.map(({ id, label, icon: Icon }) => {
                const isActive = activeCategory === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveCategory(id)}
                    className={`flex items-center gap-1 rounded-full border sm:px-4 px-3 sm:py-1 py-2 text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-orange-400 cursor-pointer ${
                      isActive
                        ? 'border-orange-400 bg-primary-200 text-orange-900'
                        : 'border-gray-200 bg-[#F3F4F6] text-gray-600 hover:border-orange-400 hover:text-orange-900 hover:bg-primary-200'
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                  </button>
                )
              })}
            </div>
          </section>

          {renderPosts()}
        </div>
      </FeedLayout>
      {activeSharePost && (
        <ShareModal
          isOpen={shareModalState.open}
          onClose={() => setShareModalState({ open: false, postId: null })}
          postUrl={shareUrl}
          postId={activeSharePost.id}
          members={memoizedMembers}
          onSendToMembers={handleSendToMembers}
        />
      )}

    </div>
  )
}

export default FeedPage
