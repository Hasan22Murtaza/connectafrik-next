'use client'

import { useAuth } from '@/contexts/AuthContext'
import CreatePost from '@/features/social/components/CreatePost'
import { PostCard } from '@/features/social/components/PostCard'
import { useCultureStats } from '@/shared/hooks/useCultureStats'
import { usePosts } from '@/shared/hooks/usePosts'
import { Camera, Globe, Heart, Plus, Users } from 'lucide-react'
import React, { useState } from 'react'
import toast from 'react-hot-toast'

const CulturePage: React.FC = () => {
  const { user } = useAuth()
  const [showCreatePost, setShowCreatePost] = useState(false)
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null)
  const { totalPosts, enthusiastsCount, categoryCounts, featuredThisWeek, loading: statsLoading, error: statsError, refetch: refetchStats } = useCultureStats()
  const { posts, loading: postsLoading, createPost, toggleLike, sharePost, refetch } = usePosts('culture', {
    cultureSubcategory: selectedSubcategory ?? undefined
  })

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

  const formatStat = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))

  return (
    <div className="min-h-screen bg-gray-50">
      
      <div className="max-w-full 2xl:max-w-screen-2xl mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex sm:items-center items-start space-x-3 mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center shrink-0">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h1 className="sm:text-3xl text-2xl font-bold text-gray-900">African Culture</h1>
              <p className="text-gray-600">Celebrating the rich cultural heritage and diversity of the African continent</p>
              {statsError && (
                <p className="text-sm text-amber-600 mt-2">Stats: {statsError}</p>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card text-center">
              <Heart className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900">
                {statsLoading ? '—' : formatStat(totalPosts)}
              </div>
              <div className="text-sm text-gray-600">Cultural Shares</div>
            </div>
            <div className="card text-center">
              <Users className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900">
                {statsLoading ? '—' : formatStat(enthusiastsCount)}
              </div>
              <div className="text-sm text-gray-600">Culture Enthusiasts</div>
            </div>
            <div className="card text-center">
              <Globe className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900">
                {statsLoading ? '—' : (totalPosts >= 1000 ? '1000+' : formatStat(totalPosts))}
              </div>
              <div className="text-sm text-gray-600">Traditions Shared</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 space-y-6">
              {/* Cultural Categories */}
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-4">Cultural Categories</h3>
                <div className="space-y-1 mb-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSubcategory(null)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedSubcategory === null ? 'bg-green-50 border border-green-200' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className="font-medium text-gray-900 text-sm">All categories</span>
                    {totalPosts > 0 && (
                      <span className="text-xs text-gray-500 ml-2">({totalPosts} posts)</span>
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
                        selectedSubcategory === cat.slug ? 'bg-green-50 border border-green-200' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex gap-3">
                        <span className="text-lg shrink-0">{cat.icon}</span>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="font-medium text-gray-900 text-sm">{cat.name}</div>
                          <div className="text-xs text-gray-500">{cat.description}</div>
                          {cat.count > 0 && (
                            <div className="text-xs text-green-600 font-medium">{cat.count} posts</div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Featured This Week */}
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-4">Featured This Week</h3>
                <div className="space-y-3">
                  {statsLoading ? (
                    <div className="text-sm text-gray-500">Loading…</div>
                  ) : featuredThisWeek.length === 0 ? (
                    <div className="text-sm text-gray-500">No activity this week yet. Be the first!</div>
                  ) : (
                    featuredThisWeek.map((culture, index) => (
                      <div key={`${culture.country}-${index}`} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium text-gray-900 text-sm">{culture.country}</div>
                          <div className="text-xs text-gray-500">{culture.feature}</div>
                        </div>
                        <div className="text-xs text-gray-400">{culture.participants}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Cultural Tips */}
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-4">Sharing Tips</h3>
                <div className="space-y-2 text-sm text-gray-600">
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
              <div className="card mb-6">
                <button
                  onClick={() => setShowCreatePost(true)}
                  className="w-full flex items-center space-x-3 p-4 text-left hover:bg-gray-50 rounded-lg transition-colors duration-200"
                >
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <Plus className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Share your cultural heritage</div>
                    <span className="text-gray-500 text-sm">What cultural tradition would you like to share today?</span>
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

            {/* Cultural Spotlight */}
            <div className="card mb-6 bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <Heart className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Cultural Spotlight</h3>
              </div>
              <p className="text-gray-700 mb-4">
                This week we're celebrating the art of <strong>African Storytelling</strong>. 
                Share your favorite folktales, proverbs, or family stories that have been passed down through generations.
              </p>
              <button className="text-green-600 font-medium text-sm hover:text-green-700">
                Learn more about African storytelling traditions →
              </button>
            </div>

            {/* Posts Feed */}
            <div>
              {postsLoading ? (
                <div className="space-y-6">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="card animate-pulse">
                      <div className="flex space-x-3 mb-4">
                        <div className="w-10 h-10 bg-gray-300 rounded-full"></div>
                        <div className="flex-1">
                          <div className="h-4 bg-gray-300 rounded w-1/4 mb-2"></div>
                          <div className="h-3 bg-gray-300 rounded w-1/3"></div>
                        </div>
                      </div>
                      <div className="space-y-2 mb-4">
                        <div className="h-4 bg-gray-300 rounded"></div>
                        <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                      </div>
                      <div className="h-32 bg-gray-300 rounded mb-4"></div>
                      <div className="flex space-x-4">
                        <div className="h-8 bg-gray-300 rounded w-16"></div>
                        <div className="h-8 bg-gray-300 rounded w-16"></div>
                        <div className="h-8 bg-gray-300 rounded w-16"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : posts.length === 0 && !postsLoading ? (
                <div className="card text-center py-12">
                  <Users className="w-16 h-16 text-green-200 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No cultural shares yet</h3>
                  <p className="text-gray-600 mb-6">Be the first to share a piece of African culture!</p>
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
                    <PostCard
                      key={post.id}
                      post={post}
                      onLike={handleLike}
                      onShare={handleShare}
                      onComment={() => {}}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CulturePage

