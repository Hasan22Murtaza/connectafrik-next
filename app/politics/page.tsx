'use client'

import { useAuth } from '@/contexts/AuthContext'
import CreatePost from '@/features/social/components/CreatePost'
import { PostCard } from '@/features/social/components/PostCard'
import CommentsSection from '@/features/social/components/CommentsSection'
import { usePoliticsStats } from '@/shared/hooks/usePoliticsStats'
import { usePosts } from '@/shared/hooks/usePosts'
import { Globe, Plus, TrendingUp, Users } from 'lucide-react'
import React, { useState } from 'react'
import toast from 'react-hot-toast'

const PoliticsPage: React.FC = () => {
  const { user } = useAuth()
  const [showCreatePost, setShowCreatePost] = useState(false)
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null)
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
  const { posts, loading: postsLoading, createPost, toggleLike, sharePost, refetch } = usePosts('politics', {
    politicsSubcategory: selectedSubcategory ?? undefined
  })

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

  return (
    <div className="min-h-screen bg-gray-50">

      <div className="max-w-full 2xl:max-w-screen-2xl mx-auto px-4 py-6">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex sm:items-center items-start space-x-3 mb-4">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center shrink-0">
              <TrendingUp className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h1 className=" sm:text-3xl text-2xl font-bold text-gray-900">African Politics</h1>
              <p className="text-gray-600">
                Engaging discussions on governance, democracy, and political development across Africa
              </p>
              {statsError && (
                <p className="text-sm text-amber-600 mt-2">Stats: {statsError}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card text-center">
              <TrendingUp className="w-8 h-8 text-red-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900">
                {statsLoading ? '—' : formatStat(totalPosts)}
              </div>
              <div className="text-sm text-gray-600">Active Discussions</div>
            </div>
            <div className="card text-center">
              <Users className="w-8 h-8 text-red-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900">
                {statsLoading ? '—' : formatStat(enthusiastsCount)}
              </div>
              <div className="text-sm text-gray-600">Political Enthusiasts</div>
            </div>
            <div className="card text-center">
              <Globe className="w-8 h-8 text-red-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900">
                {statsLoading ? '—' : countriesRepresented}
              </div>
              <div className="text-sm text-gray-600">Countries Represented</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 space-y-6">
              {/* Trending Topics */}
              <div className="card">
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
              <div className="card">
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
              <div className="card">
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
              <div className="card mb-6">
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
                    <div key={i} className="card animate-pulse">
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
                <div className="card text-center py-12">
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
                        canComment={(post as { canComment?: boolean }).canComment ?? true}
                      />
                      {showCommentsFor === post.id && (
                        <div className="lg:hidden">
                          <CommentsSection
                            postId={post.id}
                            isOpen
                            onClose={() => setShowCommentsFor(null)}
                            canComment={(post as { canComment?: boolean }).canComment ?? true}
                          />
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Desktop comment modal */}
      <div className="hidden lg:block">
        <CommentsSection
          postId={showCommentsFor ?? ''}
          isOpen={Boolean(showCommentsFor)}
          onClose={() => setShowCommentsFor(null)}
          canComment={(posts.find((p) => p.id === showCommentsFor) as { canComment?: boolean } | undefined)?.canComment ?? true}
        />
      </div>
    </div>
  )
}

export default PoliticsPage

