'use client'

import { useAuth } from '@/contexts/AuthContext'
import CreatePost from '@/features/social/components/CreatePost'
import { PostCard } from '@/features/social/components/PostCard'
import CommentsSection from '@/features/social/components/CommentsSection'
import { usePoliticsStats } from '@/shared/hooks/usePoliticsStats'
import { usePosts } from '@/shared/hooks/usePosts'
import { useEmojiReaction } from '@/shared/hooks/useEmojiReaction'
import { Globe, Plus, TrendingUp, Users, Filter } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'

const PoliticsPage: React.FC = () => {
  const { user } = useAuth()
  const [showCreatePost, setShowCreatePost] = useState(false)
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showCommentsFor, setShowCommentsFor] = useState<string | null>(null)
  const {
    totalPosts,
    enthusiastsCount,
    countriesRepresented,
    topicCounts,
    featuredThisWeek,
    loading: statsLoading,
    error: statsError,
    refetch: refetchStats
  } = usePoliticsStats()
  const { posts, loading: postsLoading, loadingMore, hasMore, loadMore, createPost, toggleLike, sharePost, refetch, updatePostLikesCount } = usePosts('politics', {
    politicsSubcategory: selectedSubcategory ?? undefined
  })
  const handleEmojiReaction = useEmojiReaction({ onLikesCountChange: updatePostLikesCount, trackEngagement: true })

  // Infinite scroll observer
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const sentinel = loadMoreRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !postsLoading && !loadingMore) {
          loadMore()
        }
      },
      { rootMargin: '300px' }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, postsLoading, loadingMore, loadMore])

  const handleCreatePost = async (postData: any) => {
    const { error } = await createPost({ ...postData, category: 'politics' })
    if (error) {
      toast.error(error)
    } else {
      toast.success('Political post created successfully!')
      setShowCreatePost(false)
      refetch()
      refetchStats()
    }
  }

  const handleLike = async (postId: string) => {
    if (!user) {
      toast.error('Please sign in to like posts')
      return
    }
    await toggleLike(postId)
  }

  const handleComment = (postId: string) => {
    setShowCommentsFor((prev) => (prev === postId ? null : postId))
  }

  const handleShare = async (postId: string) => {
    const result = await sharePost(postId)
    if (result.success) {
      toast.success('Post link copied to clipboard!')
    } else {
      toast.error('Failed to share post')
    }
  }

  const formatStat = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))

  const commentSheetPost = showCommentsFor != null ? posts.find((p) => p.id === showCommentsFor) : undefined

  return (
    <div className="min-h-screen ">

      <div className="max-w-full  px-4 sm:px-6 py-6">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex sm:items-center items-start justify-between space-x-3 mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-red-100 rounded-full  items-center justify-center shrink-0 hidden sm:flex">
                <TrendingUp className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h1 className=" sm:text-3xl text-2xl font-bold text-gray-900">African Politics</h1>
                <p className="text-gray-600 hidden sm:block mt-1">
                  Engaging discussions on governance, democracy, and political development across Africa
                </p>
                {statsError && (
                  <p className="text-sm text-amber-600 mt-2">Stats: {statsError}</p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowCategoryModal(true)}
              className="lg:hidden inline-flex items-center justify-center rounded-full bg-red-100 text-red-600  p-3 text-gray-700"
              aria-label="Open topics filter"
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-3 md:grid-cols-3 gap-2 sm:gap-4">
            <div className="bg-white rounded-2xl shadow-[0_8px_32px_rgba(255,88,20,0.04)] p-2 sm:p-4  text-center">
              <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-red-600 mx-auto mb-2" />
              <div className="text-xl sm:text-2xl font-bold text-gray-900">
                {statsLoading ? '—' : formatStat(totalPosts)}
              </div>
              <div className="text-sm text-gray-600">Active Discussions</div>
            </div>
            <div className="bg-white rounded-2xl shadow-[0_8px_32px_rgba(255,88,20,0.04)] p-2 sm:p-4  text-center">
              <Users className="w-6 h-6 sm:w-8 sm:h-8 text-red-600 mx-auto mb-2" />
              <div className="text-xl sm:text-2xl font-bold text-gray-900">
                {statsLoading ? '—' : formatStat(enthusiastsCount)}
              </div>
              <div className="text-sm text-gray-600">Political Enthusiasts</div>
            </div>
            <div className="bg-white rounded-2xl shadow-[0_8px_32px_rgba(255,88,20,0.04)] p-2 sm:p-4  text-center">
              <Globe className="w-6 h-6 sm:w-8 sm:h-8 text-red-600 mx-auto mb-2" />
              <div className="text-xl sm:text-2xl font-bold text-gray-900">
                {statsLoading ? '—' : countriesRepresented}
              </div>
              <div className="text-sm text-gray-600">Countries Represented</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="sticky top-20 space-y-6">
              {/* Trending Topics */}
              <div className="bg-white rounded-2xl shadow-[0_8px_32px_rgba(255,88,20,0.04)] p-4">
                <h3 className="font-semibold text-gray-900 mb-4">Trending Topics</h3>
                <div className="space-y-1 mb-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSubcategory(null)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedSubcategory === null ? 'bg-red-50 border border-red-200' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className="font-medium text-gray-900 text-sm">All topics</span>
                    {totalPosts > 0 && (
                      <span className="text-xs text-gray-500 ml-2">({totalPosts} discussions)</span>
                    )}
                  </button>
                </div>
                <div className="space-y-3">
                  {(statsLoading ? [] : topicCounts).map((topic) => (
                    <button
                      key={topic.slug}
                      type="button"
                      onClick={() => setSelectedSubcategory(topic.slug)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedSubcategory === topic.slug ? 'bg-red-50 border border-red-200' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex gap-3">
                        <span className="text-lg shrink-0">{topic.icon}</span>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="font-medium text-gray-900 text-sm">{topic.name}</div>
                          <div className="text-xs text-gray-500">{topic.description}</div>
                          {topic.count > 0 && (
                            <div className="text-xs text-red-600 font-medium">{topic.count} discussions</div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Featured This Week */}
              <div className="bg-white rounded-2xl shadow-[0_8px_32px_rgba(255,88,20,0.04)] p-4">
                <h3 className="font-semibold text-gray-900 mb-4">Active This Week</h3>
                <div className="space-y-3">
                  {statsLoading ? (
                    <div className="text-sm text-gray-500">Loading…</div>
                  ) : featuredThisWeek.length === 0 ? (
                    <div className="text-sm text-gray-500">No activity this week yet. Start a discussion!</div>
                  ) : (
                    featuredThisWeek.map((item, index) => (
                      <div
                        key={`${item.country}-${index}`}
                        className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg"
                      >
                        <div>
                          <div className="font-medium text-gray-900 text-sm">{item.country}</div>
                          <div className="text-xs text-gray-500">{item.feature}</div>
                        </div>
                        <div className="text-xs text-gray-400">{item.participants}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Discussion Guidelines */}
              <div className="bg-white rounded-2xl shadow-[0_8px_32px_rgba(255,88,20,0.04)] p-4">
                <h3 className="font-semibold text-gray-900 mb-4">Discussion Guidelines</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-start space-x-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>Respectful dialogue and debate</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>Fact-based discussions</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>Constructive criticism</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-red-500 mt-1">✗</span>
                    <span>Personal attacks or hate speech</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-red-500 mt-1">✗</span>
                    <span>Misinformation or propaganda</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Create Post Button */}
            {!showCreatePost && (
              <div className="bg-white rounded-2xl shadow-[0_8px_32px_rgba(255,88,20,0.04)] sm:p-4 p-2 mb-6">
                <button
                  onClick={() => setShowCreatePost(true)}
                  className="w-full flex items-center space-x-3 text-left hover:bg-gray-50 rounded-lg transition-colors duration-200"
                >
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                    <Plus className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Share your political insights</div>
                    <span className="text-gray-500 text-sm">
                      What's your take on African politics today?
                    </span>
                  </div>
                </button>
              </div>
            )}

            {/* Create Post Form */}
            {showCreatePost && (
              <div className="mb-6">
                <CreatePost
                  politicsPageMode
                  onSubmit={handleCreatePost}
                  onCancel={() => setShowCreatePost(false)}
                />
              </div>
            )}

            {/* Posts Feed */}
            <div>
              {postsLoading ? (
                <div className="space-y-6">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-white rounded-2xl shadow-[0_8px_32px_rgba(255,88,20,0.04)] p-4 animate-pulse">
                      <div className="flex space-x-3 mb-4">
                        <div className="w-10 h-10 bg-gray-300 rounded-full" />
                        <div className="flex-1">
                          <div className="h-4 bg-gray-300 rounded w-1/4 mb-2" />
                          <div className="h-3 bg-gray-300 rounded w-1/3" />
                        </div>
                      </div>
                      <div className="space-y-2 mb-4">
                        <div className="h-4 bg-gray-300 rounded" />
                        <div className="h-4 bg-gray-300 rounded w-3/4" />
                      </div>
                      <div className="flex space-x-4">
                        <div className="h-8 bg-gray-300 rounded w-16" />
                        <div className="h-8 bg-gray-300 rounded w-16" />
                        <div className="h-8 bg-gray-300 rounded w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : posts.length === 0 && !postsLoading ? (
                <div className="bg-white rounded-2xl shadow-[0_8px_32px_rgba(255,88,20,0.04)] text-center py-12">
                  <TrendingUp className="w-16 h-16 text-red-200 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No political discussions yet</h3>
                  <p className="text-gray-600 mb-6">
                    Be the first to start a conversation about African politics!
                  </p>
                  <button onClick={() => setShowCreatePost(true)} className="btn-primary">
                    Start Political Discussion
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {posts.map((post) => (
                    <React.Fragment key={post.id}>
                      <PostCard
                        post={post}
                        onLike={handleLike}
                        onComment={handleComment}
                        onShare={handleShare}
                        onEmojiReaction={handleEmojiReaction}
                        canComment={(post as { canComment?: boolean }).canComment ?? true}
                      />
                      {showCommentsFor === post.id && (
                        <div className="lg:hidden">
                          <CommentsSection
                            postId={post.id}
                            isOpen
                            onClose={() => setShowCommentsFor(null)}
                            canComment={(post as { canComment?: boolean }).canComment ?? true}
                            initialComments={(post as { comments?: any[] | null }).comments}
                            totalCommentsCount={post.comments_count}
                          />
                        </div>
                      )}
                    </React.Fragment>
                  ))}

                  {/* Infinite scroll sentinel */}
                  <div ref={loadMoreRef} className="h-1" />

                  {/* Shimmer loading skeleton for more posts */}
                  {loadingMore && (
                    <div className="space-y-6">
                      {Array.from({ length: 2 }).map((_, idx) => (
                        <div key={idx} className="bg-white rounded-2xl shadow-[0_8px_32px_rgba(255,88,20,0.04)] p-4 animate-pulse">
                          <div className="flex space-x-3 mb-4">
                            <div className="w-10 h-10 bg-gray-300 rounded-full" />
                            <div className="flex-1">
                              <div className="h-4 bg-gray-300 rounded w-1/4 mb-2" />
                              <div className="h-3 bg-gray-300 rounded w-1/3" />
                            </div>
                          </div>
                          <div className="space-y-2 mb-4">
                            <div className="h-4 bg-gray-300 rounded" />
                            <div className="h-4 bg-gray-300 rounded w-3/4" />
                          </div>
                          <div className="flex space-x-4">
                            <div className="h-8 bg-gray-300 rounded w-16" />
                            <div className="h-8 bg-gray-300 rounded w-16" />
                            <div className="h-8 bg-gray-300 rounded w-16" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* End of feed message — only show if more than one page was loaded */}
                  {!hasMore && posts.length >= 10 && (
                    <div className="py-6 text-center text-sm text-gray-400">
                      You&apos;ve reached the end of political discussions
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile category modal */}
      {showCategoryModal && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCategoryModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-h-[80vh] w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4 bg-red-100">
              <div>
                <h2 className="text-lg font-semibold text-red-600">Trending Topics</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCategoryModal(false)}
                className="text-red-600 hover:text-red-800"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
              <button
                type="button"
                onClick={() => {
                  setSelectedSubcategory(null)
                  setShowCategoryModal(false)
                }}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  selectedSubcategory === null ? 'bg-red-50 border border-red-200' : 'hover:bg-gray-50'
                }`}
              >
                <span className="font-medium text-gray-900 text-sm">All topics</span>
                {totalPosts > 0 && (
                  <span className="text-xs text-gray-500 ml-2">({totalPosts} discussions)</span>
                )}
              </button>

              {(statsLoading ? [] : topicCounts).map((topic) => (
                <button
                  key={topic.slug}
                  type="button"
                  onClick={() => {
                    setSelectedSubcategory(topic.slug)
                    setShowCategoryModal(false)
                  }}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedSubcategory === topic.slug ? 'bg-red-50 border border-red-200' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex gap-3">
                    <span className="text-lg shrink-0">{topic.icon}</span>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="font-medium text-gray-900 text-sm">{topic.name}</div>
                      <div className="text-xs text-gray-500">{topic.description}</div>
                      {topic.count > 0 && (
                        <div className="text-xs text-red-600 font-medium">{topic.count} discussions</div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="border-t border-gray-200 p-4">
              <button
                type="button"
                onClick={() => {
                  setSelectedSubcategory(null)
                  setShowCategoryModal(false)
                }}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-lg transition-colors"
              >
                Clear Filter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop comment modal */}
      <div className="hidden lg:block">
        <CommentsSection
          postId={showCommentsFor ?? ''}
          isOpen={Boolean(showCommentsFor)}
          onClose={() => setShowCommentsFor(null)}
          canComment={(commentSheetPost as { canComment?: boolean } | undefined)?.canComment ?? true}
          initialComments={(commentSheetPost as { comments?: any[] | null } | undefined)?.comments}
          totalCommentsCount={commentSheetPost?.comments_count}
        />
      </div>
    </div>
  )
}

export default PoliticsPage

