'use client'

import { useAuth } from '@/contexts/AuthContext'
import CreatePost from '@/features/social/components/CreatePost'
import { PostCard } from '@/features/social/components/PostCard'
import CommentsSection from '@/features/social/components/CommentsSection'
import { useCultureStats } from '@/shared/hooks/useCultureStats'
import { usePosts } from '@/shared/hooks/usePosts'
import { useEmojiReaction } from '@/shared/hooks/useEmojiReaction'
import { Camera, Filter, Globe, Heart, Plus, Users } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'

const CulturePage: React.FC = () => {
  const { user } = useAuth()
  const [showCreatePost, setShowCreatePost] = useState(false)
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showCommentsFor, setShowCommentsFor] = useState<string | null>(null)
  const { totalPosts, enthusiastsCount, categoryCounts, featuredThisWeek, loading: statsLoading, error: statsError, refetch: refetchStats } = useCultureStats()
  const { posts, loading: postsLoading, loadingMore, hasMore, loadMore, createPost, toggleLike, sharePost, refetch, updatePostLikesCount } = usePosts('culture', {
    cultureSubcategory: selectedSubcategory ?? undefined
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
    const { error } = await createPost({ ...postData, category: 'culture' })
    if (error) {
      toast.error(error)
    } else {
      toast.success('Cultural post shared successfully!')
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

  const handleShare = async (postId: string) => {
    const result = await sharePost(postId)
    if (result.success) {
      toast.success('Cultural post shared!')
    } else {
      toast.error('Failed to share post')
    }
  }

  const handleComment = (postId: string) => {
    setShowCommentsFor((prev) => (prev === postId ? null : postId))
  }

  const formatStat = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))

  const commentSheetPost = showCommentsFor != null ? posts.find((p) => p.id === showCommentsFor) : undefined

  return (
    <div className="min-h-screen bg-surface-canvas">
      
      <div className="max-w-full  px-4 sm:px-6 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center  justify-between space-x-3 mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-green-100 rounded-full  items-center justify-center shrink-0 hidden sm:flex">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h1 className="sm:text-3xl text-2xl font-bold text-content">African Culture</h1>
                <p className="text-content-secondary hidden sm:block">
                  Celebrating the rich cultural heritage and diversity of the African continent
                </p>
                {statsError && (
                  <p className="text-sm text-amber-600 mt-2">Stats: {statsError}</p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowCategoryModal(true)}
              className="lg:hidden inline-flex text-green-600 bg-green-100 rounded-full p-3"
              aria-label="Open categories filter"
            >
              <Filter className="w-5 h-5" />
            </button>

            
          </div>
          
          <div className="grid grid-cols-3 md:grid-cols-3 sm:gap-4 gap-2">
            <div className="bg-surface rounded-2xl shadow-[0_8px_32px_rgba(72,187,120,0.04)] p-4 text-center">
              <Heart className="w-6 h-6 sm:w-8 sm:h-8 text-green-600 mx-auto mb-2" />
              <div className="sm:text-2xl text-lg font-bold text-content">
                {statsLoading ? '—' : formatStat(totalPosts)}
              </div>
              <div className="text-sm text-content-secondary">Cultural Shares</div>
            </div>
            <div className="bg-surface rounded-2xl shadow-[0_8px_32px_rgba(72,187,120,0.04)] p-4 text-center">
              <Users className="w-6 h-6 sm:w-8 sm:h-8 text-green-600 mx-auto mb-2" />
              <div className="sm:text-2xl text-lg font-bold text-content">
                {statsLoading ? '—' : formatStat(enthusiastsCount)}
              </div>
              <div className="text-sm text-content-secondary">Culture Enthusiasts</div>
            </div>
            <div className="bg-surface rounded-2xl shadow-[0_8px_32px_rgba(72,187,120,0.04)] p-4 text-center">
              <Globe className="w-6 h-6 sm:w-8 sm:h-8 text-green-600 mx-auto mb-2" />
              <div className="sm:text-2xl text-lg font-bold text-content">
                {statsLoading ? '—' : (totalPosts >= 1000 ? '1000+' : formatStat(totalPosts))}
              </div>
              <div className="text-sm text-content-secondary">Traditions Shared</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="sticky top-20 space-y-6">
              {/* Cultural Categories */}
              <div className="bg-surface rounded-2xl shadow-[0_8px_32px_rgba(72,187,120,0.04)] p-4">
                <h3 className="font-semibold text-content mb-4">Cultural Categories</h3>
                <div className="space-y-1 mb-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSubcategory(null)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedSubcategory === null
                        ? 'bg-green-50 border border-green-200 text-green-900 dark:text-green-200'
                        : 'hover:bg-surface-hover text-content'
                    }`}
                  >
                    <span className="font-medium text-sm">All categories</span>
                    {totalPosts > 0 && (
                      <span className="text-xs opacity-75 ml-2">({totalPosts} posts)</span>
                    )}
                  </button>
                </div>
                <div className="space-y-3">
                  {(statsLoading ? [] : categoryCounts).map((cat) => (
                    <button
                      key={cat.slug}
                      type="button"
                      onClick={() => setSelectedSubcategory(cat.slug)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedSubcategory === cat.slug
                          ? 'bg-green-50 border border-green-200 text-green-900 dark:text-green-200'
                          : 'hover:bg-surface-hover text-content'
                      }`}
                    >
                      <div className="flex gap-3">
                        <span className="text-lg shrink-0">{cat.icon}</span>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="font-medium text-sm">{cat.name}</div>
                          <div className={`text-xs ${selectedSubcategory === cat.slug ? 'opacity-80' : 'text-content-secondary'}`}>{cat.description}</div>
                          {cat.count > 0 && (
                            <div className={`text-xs font-medium ${selectedSubcategory === cat.slug ? 'text-green-700 dark:text-green-300' : 'text-green-600'}`}>{cat.count} posts</div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Featured This Week */}
              <div className="bg-surface rounded-2xl shadow-[0_8px_32px_rgba(72,187,120,0.04)] p-4">
                <h3 className="font-semibold text-content mb-4">Featured This Week</h3>
                <div className="space-y-3">
                  {statsLoading ? (
                    <div className="text-sm text-content-secondary">Loading…</div>
                  ) : featuredThisWeek.length === 0 ? (
                    <div className="text-sm text-content-secondary">No activity this week yet. Be the first!</div>
                  ) : (
                    featuredThisWeek.map((culture, index) => (
                      <div key={`${culture.country}-${index}`} className="flex items-center justify-between p-2 hover:bg-surface-hover rounded-lg">
                        <div>
                          <div className="font-medium text-content text-sm">{culture.country}</div>
                          <div className="text-xs text-content-secondary">{culture.feature}</div>
                        </div>
                        <div className="text-xs text-content-tertiary">{culture.participants}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Cultural Tips */}
              <div className="bg-surface rounded-2xl shadow-[0_8px_32px_rgba(72,187,120,0.04)] p-4">
                <h3 className="font-semibold text-content mb-4">Sharing Tips</h3>
                <div className="space-y-2 text-sm text-content-secondary">
                  <div className="flex items-start space-x-2">
                    <Camera className="w-4 h-4 text-green-500 mt-1" />
                    <span>Add photos to showcase traditions</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>Share the story behind the culture</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>Respect cultural sensitivities</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>Credit sources and origins</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Create Post Button */}
            {!showCreatePost && (
              <div className="bg-surface rounded-2xl shadow-[0_8px_32px_rgba(72,187,120,0.04)] sm:p-4 p-2  mb-6">
                <button
                  onClick={() => setShowCreatePost(true)}
                  className="w-full flex items-center space-x-3  text-left hover:bg-surface-hover rounded-lg transition-colors duration-200"
                >
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                    <Plus className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <div className="font-medium text-content">Share your cultural heritage</div>
                    <span className="text-content-secondary text-sm">What cultural tradition would you like to share today?</span>
                  </div>
                </button>
              </div>
            )}

            {/* Create Post Form */}
            {showCreatePost && (
              <div className="mb-6">
                <CreatePost
                  culturePageMode
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
                    <div key={i} className="bg-surface rounded-2xl shadow-[0_8px_32px_rgba(72,187,120,0.04)] p-4 animate-pulse">
                      <div className="flex space-x-3 mb-4">
                        <div className="w-10 h-10 bg-surface-tertiary rounded-full"></div>
                        <div className="flex-1">
                          <div className="h-4 bg-surface-tertiary rounded w-1/4 mb-2"></div>
                          <div className="h-3 bg-surface-tertiary rounded w-1/3"></div>
                        </div>
                      </div>
                      <div className="space-y-2 mb-4">
                        <div className="h-4 bg-surface-tertiary rounded"></div>
                        <div className="h-4 bg-surface-tertiary rounded w-3/4"></div>
                      </div>
                      <div className="h-32 bg-surface-tertiary rounded mb-4"></div>
                      <div className="flex space-x-4">
                        <div className="h-8 bg-surface-tertiary rounded w-16"></div>
                        <div className="h-8 bg-surface-tertiary rounded w-16"></div>
                        <div className="h-8 bg-surface-tertiary rounded w-16"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : posts.length === 0 && !postsLoading ? (
                <div className="bg-surface rounded-2xl shadow-[0_8px_32px_rgba(72,187,120,0.04)] p-4 text-center py-12">
                  <Users className="w-16 h-16 text-green-200 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-content mb-2">No cultural shares yet</h3>
                  <p className="text-content-secondary mb-6">Be the first to share a piece of African culture!</p>
                  <button
                    onClick={() => setShowCreatePost(true)}
                    className="btn-primary bg-green-600 hover:bg-green-700"
                  >
                    Share Cultural Heritage
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {posts.map(post => (
                    <React.Fragment key={post.id}>
                      <PostCard
                        post={post}
                        onLike={handleLike}
                        onShare={handleShare}
                        onComment={handleComment}
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
                        <div key={idx} className="bg-surface rounded-2xl shadow-[0_8px_32px_rgba(72,187,120,0.04)] p-4 animate-pulse">
                          <div className="flex space-x-3 mb-4">
                            <div className="w-10 h-10 bg-surface-tertiary rounded-full" />
                            <div className="flex-1">
                              <div className="h-4 bg-surface-tertiary rounded w-1/4 mb-2" />
                              <div className="h-3 bg-surface-tertiary rounded w-1/3" />
                            </div>
                          </div>
                          <div className="space-y-2 mb-4">
                            <div className="h-4 bg-surface-tertiary rounded" />
                            <div className="h-4 bg-surface-tertiary rounded w-3/4" />
                          </div>
                          <div className="h-32 bg-surface-tertiary rounded mb-4" />
                          <div className="flex space-x-4">
                            <div className="h-8 bg-surface-tertiary rounded w-16" />
                            <div className="h-8 bg-surface-tertiary rounded w-16" />
                            <div className="h-8 bg-surface-tertiary rounded w-16" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* End of feed message — only show if more than one page was loaded */}
                  {!hasMore && posts.length >= 10 && (
                    <div className="py-6 text-center text-sm text-content-tertiary">
                      You&apos;ve reached the end of cultural posts
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
          <div className="relative bg-surface rounded-2xl shadow-2xl max-h-[80vh] w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-4 bg-green-100">
              <div>
                <h2 className="text-lg font-semibold text-green-600">Cultural Categories</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCategoryModal(false)}
                className="text-green-600 hover:text-green-800 rounded-full p-2 transition-colors"
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
                  selectedSubcategory === null
                    ? 'bg-green-50 border border-green-200 text-green-900 dark:text-green-200'
                    : 'hover:bg-surface-hover text-content'
                }`}
              >
                <span className="font-medium text-sm">All categories</span>
                {totalPosts > 0 && (
                  <span className="text-xs opacity-75 ml-2">({totalPosts} posts)</span>
                )}
              </button>

              {(statsLoading ? [] : categoryCounts).map((cat) => (
                <button
                  key={cat.slug}
                  type="button"
                  onClick={() => {
                    setSelectedSubcategory(cat.slug)
                    setShowCategoryModal(false)
                  }}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedSubcategory === cat.slug
                      ? 'bg-green-50 border border-green-200 text-green-900 dark:text-green-200'
                      : 'hover:bg-surface-hover text-content'
                  }`}
                >
                  <div className="flex gap-3">
                    <span className="text-lg shrink-0">{cat.icon}</span>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="font-medium text-sm">{cat.name}</div>
                      <div className={`text-xs ${selectedSubcategory === cat.slug ? 'opacity-80' : 'text-content-secondary'}`}>{cat.description}</div>
                      {cat.count > 0 && (
                        <div className={`text-xs font-medium ${selectedSubcategory === cat.slug ? 'text-green-700 dark:text-green-300' : 'text-green-600'}`}>{cat.count} posts</div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="border-t border-border p-4">
              <button
                type="button"
                onClick={() => {
                  setSelectedSubcategory(null)
                  setShowCategoryModal(false)
                }}
                className="w-full bg-surface-secondary hover:bg-surface-hover text-content font-medium py-3 px-4 rounded-lg transition-colors"
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

export default CulturePage

