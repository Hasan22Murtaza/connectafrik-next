'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Globe, TrendingUp, Users, Sparkles } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { usePosts } from '@/shared/hooks/usePosts'
import { useMembers } from '@/shared/hooks/useMembers'
import FeedLayout from '@/shared/components/layout/FeedLayout'
import Advertisement from '@/shared/components/ui/Advertisement'
import StoriesBar from '@/features/social/components/StoriesBar'
import CreatePost from '@/features/social/components/CreatePost'
import { PostCard } from '@/features/social/components/PostCard'
import CommentsSection from '@/features/social/components/CommentsSection'
import ShareModal from '@/features/social/components/ShareModal'
import { updateEngagementReward } from '@/features/social/services/fairnessRankingService'
import { trackEvent } from '@/features/social/services/engagementTracking'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { getReactionTypeFromEmoji } from '@/shared/utils/reactionUtils'

const FEED_CATEGORIES = [
  { id: 'all' as const, label: 'All Posts', icon: Globe },
  { id: 'politics' as const, label: 'Politics', icon: TrendingUp },
  { id: 'culture' as const, label: 'Culture', icon: Users },
]

type CategoryFilter = typeof FEED_CATEGORIES[number]['id'] | 'general'

const FeedPage: React.FC = () => {
  const { user } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all')
  const [shareModalState, setShareModalState] = useState<{ open: boolean; postId: string | null }>({ open: false, postId: null })
  const [showCommentsFor, setShowCommentsFor] = useState<string | null>(null)
  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const [explorationBoost, setExplorationBoost] = useState(false)

  const { posts, loading, createPost, toggleLike, deletePost, updatePost, recordView, updatePostLikesCount } = usePosts(activeCategory)
  const { members } = useMembers()

  // Sort posts by creation date (newest first)
  const rankedPosts = useMemo(() => {
    if (!posts.length) return []

    // Sort posts by created_at in descending order (newest first)
    return [...posts].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime()
      const dateB = new Date(b.created_at).getTime()
      return dateB - dateA // Descending order (newest first)
    })
  }, [posts])

  const filteredPosts = useMemo(() => {
    if (!searchTerm.trim()) return rankedPosts
    const term = searchTerm.toLowerCase()
    return rankedPosts.filter((post) =>
      post.title.toLowerCase().includes(term) ||
      post.content.toLowerCase().includes(term) ||
      post.author?.full_name?.toLowerCase().includes(term) ||
      post.author?.username?.toLowerCase().includes(term)
    )
  }, [rankedPosts, searchTerm])

  const memoizedMembers = useMemo(() => members, [members])

  const handleCreatePost = useCallback(async (postData: {
    title: string
    content: string
    category: 'politics' | 'culture' | 'general'
    media_urls?: string[]
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
  }, [posts, toggleLike, user])

  const handleComment = useCallback((postId: string) => {
    const post = posts.find(p => p.id === postId)
    if (post?.author_id) {
      updateEngagementReward(post.author_id, 'comment')
    }
    setShowCommentsFor((prev) => (prev === postId ? null : postId))

    // Track engagement event
    if (user?.id) {
      trackEvent.comment(user.id, postId)
    }
  }, [posts, user])

  function getEmojiUnicodeCodes(emoji: string): string {
  // Convert the emoji into array of code points, then convert each to hex string
  const codePoints = Array.from(emoji).map(char =>
    char.codePointAt(0)?.toString(16).toUpperCase()
  );

  return codePoints?.join(" ");
}

  const handleEmojiReaction = useCallback(async (postId: string, emoji: string) => {
    try {
      if (!user) {
        toast.error('Please sign in to react');
        return;
      }

      const reactionType = getReactionTypeFromEmoji(emoji);

      // Check if user already has a reaction for this post
      const { data: existingReaction, error: checkError } = await supabase
        .from('post_reactions')
        .select('id, reaction_type')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error checking existing reaction:', checkError);
        toast.error('Failed to check reaction');
        return;
      }

      // If user already reacted with the same type, remove it (toggle off)
      if (existingReaction && existingReaction.reaction_type === reactionType) {
        const { error: deleteError } = await supabase
          .from('post_reactions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id)
          .eq('reaction_type', reactionType);

        if (deleteError) {
          console.error('Error removing reaction:', deleteError);
          toast.error('Failed to remove reaction');
          return;
        }

        // Decrement likes_count in posts table
        const { data: currentPost, error: fetchError } = await supabase
          .from('posts')
          .select('likes_count')
          .eq('id', postId)
          .single();

        if (!fetchError && currentPost) {
          const newLikesCount = Math.max(0, (currentPost.likes_count || 0) - 1);
          const { error: updateError } = await supabase
            .from('posts')
            .update({ likes_count: newLikesCount })
            .eq('id', postId);

          if (updateError) {
            console.error('Error updating likes count:', updateError);
          } else {
            // Update local state for real-time UI update
            updatePostLikesCount(postId, -1);
          }
        }

        toast.success('Reaction removed');
        // Trigger a custom event to refetch reactions in PostCard
        window.dispatchEvent(new CustomEvent('reaction-updated', { detail: { postId } }));
        return;
      }

      // If user has a different reaction, update it
      if (existingReaction) {
        const { error: updateError } = await supabase
          .from('post_reactions')
          .update({ reaction_type: reactionType })
          .eq('post_id', postId)
          .eq('user_id', user.id);

        if (updateError) {
          console.error('Error updating reaction:', updateError);
          toast.error('Failed to update reaction');
          return;
        }

        toast.success('Reaction updated');
        // Trigger a custom event to refetch reactions in PostCard
        window.dispatchEvent(new CustomEvent('reaction-updated', { detail: { postId } }));
        return;
      }

      // Insert new reaction
      const { error: insertError } = await supabase
        .from('post_reactions')
        .insert({
          post_id: postId,
          user_id: user.id,
          reaction_type: reactionType
        });

      if (insertError) {
        console.error('Error inserting reaction:', insertError);
        toast.error('Failed to save reaction');
        return;
      }

      // Increment likes_count in posts table
      const { data: currentPost, error: fetchError } = await supabase
        .from('posts')
        .select('likes_count, author_id')
        .eq('id', postId)
        .single();

      if (!fetchError && currentPost) {
        const newLikesCount = (currentPost.likes_count || 0) + 1;
        const { error: updateError } = await supabase
          .from('posts')
          .update({ likes_count: newLikesCount })
          .eq('id', postId);

        if (updateError) {
          console.error('Error updating likes count:', updateError);
        } else {
          // Update local state for real-time UI update
          updatePostLikesCount(postId, 1);
        }

        // Update engagement reward for post author
        if (currentPost.author_id) {
          updateEngagementReward(currentPost.author_id, 'like');
        }
      }

      // Track engagement event
      trackEvent.like(user.id, postId);

      toast.success('Reaction saved!');
      // Trigger a custom event to refetch reactions in PostCard
      window.dispatchEvent(new CustomEvent('reaction-updated', { detail: { postId } }));
    } catch (error: any) {
      console.error('Error handling emoji reaction:', error);
      toast.error('Something went wrong');
    }
  }, [user, posts, updatePostLikesCount]);



  const handleShare = useCallback((postId: string) => {
    const post = posts.find(p => p.id === postId)
    if (post?.author_id) {
      updateEngagementReward(post.author_id, 'share')
    }
    setShareModalState({ open: true, postId })

    // Track engagement event
    if (user?.id) {
      trackEvent.share(user.id, postId)
    }
  }, [posts, user])

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

  const handleEdit = useCallback((postId: string, newContent: string) => {
    updatePost(postId, newContent)
  }, [updatePost])

  const handleSendToMembers = useCallback(async (memberIds: string[], message: string) => {
    if (!memberIds.length) {
      toast.success('No members selected')
      return
    }
    toast.success(`Shared with ${memberIds.length} member${memberIds.length === 1 ? '' : 's'}`)
  }, [])





  const activeSharePost = useMemo(() => (
    shareModalState.postId ? posts.find((post) => post.id === shareModalState.postId) : null
  ), [posts, shareModalState.postId])

  const shareUrl = useMemo(() => {
    if (!shareModalState.postId) return ''
    if (typeof window === 'undefined') return `/post/${shareModalState.postId}`
    return `${process.env.NEXT_PUBLIC_APP_UR}/post/${shareModalState.postId}`
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
      <div className="space-y-4 sm:space-y-6">
        {filteredPosts.map((post) => (
          <React.Fragment key={post.id}>
            <PostCard
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
            />
            {/* Mobile inline comments */}
            {showCommentsFor === post.id && (
              <div className="lg:hidden">
                <CommentsSection
                  postId={post.id}
                  isOpen={true}
                  onClose={() => setShowCommentsFor(null)}
                  canComment={post.canComment}
                />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 max-w-full 2xl:max-w-screen-2xl mx-auto ">

      <FeedLayout>
        <div className="w-full space-y-6 sm:space-y-8">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-r from-orange-100 to-green-100">
            <Advertisement type="banner" placement="feed-top" className="rounded-none" />
          </div>

          <StoriesBar />


          <section className="rounded-2xl border border-gray-200 bg-white p-2 sm:p-6">
            {!user ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
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
                className="flex w-full items-center space-x-4 rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-left transition-colors hover:border-primary-200 hover:bg-primary-50"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 text-gray-600 shrink-0">
                  <Plus className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-base font-semibold text-gray-700">Share your thoughts with the community...</p>
                  <p className="text-sm text-gray-500">Tap to start a post</p>
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
      {/* Desktop modal comments */}
      <div className="hidden lg:block">
        <CommentsSection
          postId={showCommentsFor ?? ''}
          isOpen={Boolean(showCommentsFor)}
          onClose={() => setShowCommentsFor(null)}
          canComment={posts.find(p => p.id === showCommentsFor)?.canComment}
        />
      </div>

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
