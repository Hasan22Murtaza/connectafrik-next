'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  ArrowLeft, 
  UserPlus, 
  UserCheck, 
  MessageCircle, 
  Phone, 
  Video, 
  MoreHorizontal,
  MapPin,
  Calendar,
  Users,
  Heart,
  MessageSquare,
  Share2,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useProductionChat } from '@/contexts/ProductionChatContext'
import { followUser, unfollowUser, checkIsFollowing } from '@/features/social/services/followService'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import { UserProfile, MutualFriend, Post } from '@/shared/types'

const UserProfilePage: React.FC = () => {
  const params = useParams()
  const router = useRouter()
  const username = params?.username as string
  const { user } = useAuth()
  const { startChatWithMembers, openThread, startCall } = useProductionChat()
  
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [mutualFriends, setMutualFriends] = useState<MutualFriend[]>([])
  const [mutualFriendsCount, setMutualFriendsCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  useEffect(() => {
    if (username) {
      fetchUserProfile()
    }
  }, [username])

  useEffect(() => {
    if (profile && user && user.id !== profile.id) {
      checkFollowStatus()
    }
  }, [profile, user])

  const fetchUserProfile = async () => {
    try {
      setLoading(true)
      
      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single()

      if (profileError) throw profileError
      setProfile(profileData)

      // Fetch user posts
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('*')
        .eq('author_id', profileData.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(20)

      if (postsError) throw postsError
      setPosts(postsData || [])

      // Check if current user is following this user and fetch mutual friends
      if (user && user.id !== profileData.id) {
        await checkFollowStatus()
        await fetchMutualFriends(user.id, profileData.id)
      }

    } catch (error: any) {
      console.error('Error fetching user profile:', error)
      toast.error('User not found')
      router.push('/feed')
    } finally {
      setLoading(false)
    }
  }

  const fetchMutualFriends = async (currentUserId: string, targetUserId: string) => {
    try {
      // Get mutual friends count
      const { data: countData, error: countError } = await supabase.rpc('get_mutual_friends_count', {
        user1_id: currentUserId,
        user2_id: targetUserId
      })

      if (countError) throw countError
      setMutualFriendsCount(countData || 0)

      // Get mutual friends list (limit to 6 for display)
      const { data: friendsData, error: friendsError } = await supabase.rpc('get_mutual_friends', {
        user1_id: currentUserId,
        user2_id: targetUserId,
        limit_count: 6
      })

      if (friendsError) throw friendsError
      setMutualFriends(friendsData || [])
    } catch (error) {
      console.error('Error fetching mutual friends:', error)
    }
  }

  const checkFollowStatus = async () => {
    if (!user || !profile) return
    
    try {
      const following = await checkIsFollowing(user.id, profile.id)
      setIsFollowing(following)
    } catch (error) {
      console.error('Error checking follow status:', error)
    }
  }

  const handleFollow = async () => {
    if (!user || !profile) return
    
    try {
      setFollowLoading(true)
      
      if (isFollowing) {
        const success = await unfollowUser(user.id, profile.id)
        if (success) {
          setIsFollowing(false)
          setProfile(prev => prev ? { ...prev, followers_count: prev.followers_count - 1 } : null)
          toast.success(`Untapped from ${profile.full_name}`)
        } else {
          toast.error('Failed to untap')
        }
      } else {
        const success = await followUser(user.id, profile.id)
        if (success) {
          setIsFollowing(true)
          setProfile(prev => prev ? { ...prev, followers_count: prev.followers_count + 1 } : null)
          toast.success(`Tapped in to ${profile.full_name}`)
        } else {
          // Check if already following (failed because duplicate)
          const stillFollowing = await checkIsFollowing(user.id, profile.id)
          if (stillFollowing) {
            setIsFollowing(true)
            toast.success('Already tapped in!')
          } else {
            toast.error('Failed to tap in')
          }
        }
      }
    } catch (error: any) {
      console.error('Error tapping in/out:', error)
      toast.error(error.message || 'Something went wrong')
    } finally {
      setFollowLoading(false)
    }
  }

  const handleStartChat = async () => {
    if (!profile || !user) return
    
    try {
      const chatParticipant = {
        id: profile.id,
        name: profile.full_name,
        avatarUrl: profile.avatar_url || undefined
      }
      
      const threadId = await startChatWithMembers([chatParticipant], { 
        participant_ids: [profile.id], 
        openInDock: true 
      })
      
      if (threadId) {
        openThread(threadId)
        toast.success(`Chat opened with ${profile.full_name}`)
      }
    } catch (error) {
      console.error('Error starting chat:', error)
      toast.error('Failed to start chat')
    }
  }

  const handleCall = async (isVideoCall: boolean = false) => {
    if (!profile || !user) return
    
    try {
      // First create a chat thread, then start the call
      const chatParticipant = {
        id: profile.id,
        name: profile.full_name,
        avatarUrl: profile.avatar_url || undefined
      }
      
      const threadId = await startChatWithMembers([chatParticipant], { 
        participant_ids: [profile.id], 
        openInDock: true 
      })
      
      if (threadId) {
        await startCall(threadId, isVideoCall ? 'video' : 'audio')
        toast.success(`${isVideoCall ? 'Video' : 'Audio'} call started with ${profile.full_name}`)
      } else {
        toast.error('Failed to create chat thread for call')
      }
    } catch (error) {
      console.error('Error starting call:', error)
      toast.error('Failed to start call. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
            <span className="text-lg text-gray-600 font-semibold">Loading profile...</span>
          </div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">User not found</h1>
            <p className="text-gray-600 mb-4">The user you're looking for doesn't exist.</p>
            <button
              onClick={() => router.push('/feed')}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Back to Feed
            </button>
          </div>
        </div>
      </div>
    )
  }

  const isOwnProfile = user && user.id === profile.id

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Profile Header - Mobile Optimized */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-start mb-6" style={{ gap: '16px' }}>
            <div className="relative">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={`${profile.full_name}'s avatar`}
                  className="w-20 h-20  rounded-full object-cover"
                />
              ) : (
                <div className="w-20 h-20  bg-gray-300 rounded-full flex items-center justify-center">
                  <span className="text-gray-600 font-bold text-xl sm:text-2xl">
                    {profile.full_name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              {profile.is_verified && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center mb-1" style={{ gap: '8px' }}>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
                  {profile.full_name}
                </h1>
                <span className="text-gray-500 text-sm sm:text-lg">@{profile.username}</span>
              </div>
              
              <div className="flex items-center text-xs sm:text-sm" style={{ gap: '16px' }}>
                <div className="flex items-center" style={{ gap: '4px' }}>
                  <Users className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
                  <span className="font-semibold">{profile.followers_count}</span>
                  <span className="text-gray-500">tapped in</span>
                </div>
                <div className="flex items-center" style={{ gap: '4px' }}>
                  <UserCheck className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
                  <span className="font-semibold">{profile.following_count}</span>
                  <span className="text-gray-500">tapping in</span>
                </div>
                <div className="flex items-center" style={{ gap: '4px' }}>
                  <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
                  <span className="font-semibold">{profile.posts_count}</span>
                  <span className="text-gray-500">posts</span>
                </div>
              </div>
            </div>

            {!isOwnProfile && (
              <div className="flex flex-col sm:flex-row w-full sm:w-auto" style={{ gap: '8px' }}>
                <button
                  onClick={handleFollow}
                  disabled={followLoading}
                  className={`flex items-center justify-center px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isFollowing
                      ? 'bg-gray-600 text-white hover:bg-gray-700'
                      : 'bg-orange-500 text-white hover:bg-orange-600'
                  }`}
                  style={{ gap: '8px' }}
                >
                  {followLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : isFollowing ? (
                    <UserCheck className="w-4 h-4" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  <span>{isFollowing ? 'Tapped In' : 'Tap In'}</span>
                </button>

                <button
                  onClick={handleStartChat}
                  className="flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  style={{ gap: '8px' }}
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Message</span>
                </button>

                <div className="relative">
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="w-full sm:w-auto p-2 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center"
                    style={{ gap: '8px' }}
                  >
                    <MoreHorizontal className="w-4 h-4 text-gray-600" />
                    <span className="sm:hidden">More</span>
                  </button>

                  {showMenu && (
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                      <button
                        onClick={() => {
                          handleCall(false)
                          setShowMenu(false)
                        }}
                        className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex items-center"
                        style={{ gap: '8px' }}
                      >
                        <Phone className="w-4 h-4" />
                        <span>Call</span>
                      </button>
                      <button
                        onClick={() => {
                          handleCall(true)
                          setShowMenu(false)
                        }}
                        className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex items-center"
                        style={{ gap: '8px' }}
                      >
                        <Video className="w-4 h-4" />
                        <span>Video Call</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {isOwnProfile && (
              <button
                onClick={() => router.push('/profile')}
                className="w-full sm:w-auto px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Edit Profile
              </button>
            )}
          </div>

          <div className="space-y-4">
            {profile.bio && (
              <p className="text-gray-700 text-sm sm:text-base">{profile.bio}</p>
            )}

            <div className="flex flex-wrap items-center text-xs sm:text-sm text-gray-500" style={{ gap: '12px' }}>
              {profile.country && (
                <div className="flex items-center" style={{ gap: '4px' }}>
                  <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>{profile.country}</span>
                </div>
              )}
              <div className="flex items-center" style={{ gap: '4px' }}>
                <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                <span>Joined {formatDistanceToNow(new Date(profile.created_at), { addSuffix: true })}</span>
              </div>
            </div>

            {user && user.id !== profile.id && mutualFriendsCount > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-700">
                    {mutualFriendsCount} mutual {mutualFriendsCount === 1 ? 'friend' : 'friends'}
                  </h3>
                </div>
                <div className="flex items-center" style={{ gap: '8px' }}>
                  {mutualFriends.slice(0, 6).map((friend) => (
                    <div
                      key={friend.user_id}
                      className="relative group cursor-pointer"
                      onClick={() => router.push(`/user/${friend.username}`)}
                    >
                      {friend.avatar_url ? (
                        <img
                          src={friend.avatar_url}
                          alt={friend.full_name}
                          className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center border-2 border-white shadow-sm">
                          <span className="text-xs font-semibold text-primary-700">
                            {friend.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                      <div 
                        className="absolute -bottom-8 left-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10"
                        style={{ transform: 'translateX(-50%)' }}
                      >
                        {friend.full_name}
                      </div>
                    </div>
                  ))}
                  {mutualFriendsCount > 6 && (
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center border-2 border-white shadow-sm">
                      <span className="text-xs font-semibold text-gray-600">
                        +{mutualFriendsCount - 6}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Posts Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Posts</h2>
          
          {posts.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No posts yet</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {posts.map((post) => (
                <div key={post.id} className="border-b border-gray-100 pb-4 last:border-b-0">
                  <div className="flex items-start" style={{ gap: '12px' }}>
                    <div className="flex-1">
                      {post.title && (
                        <h3 className="font-semibold text-gray-900 mb-1">{post.title}</h3>
                      )}
                      <p className="text-gray-700 mb-2">{post.content}</p>
                      
                      <div className="flex items-center text-sm text-gray-500" style={{ gap: '16px' }}>
                        <div className="flex items-center" style={{ gap: '4px' }}>
                          <Heart className="w-4 h-4" />
                          <span>{post.likes_count}</span>
                        </div>
                        <div className="flex items-center" style={{ gap: '4px' }}>
                          <MessageSquare className="w-4 h-4" />
                          <span>{post.comments_count}</span>
                        </div>
                        <div className="flex items-center" style={{ gap: '4px' }}>
                          <Share2 className="w-4 h-4" />
                          <span>{post.shares_count}</span>
                        </div>
                        <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default UserProfilePage

