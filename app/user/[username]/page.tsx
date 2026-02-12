'use client'

import React, { useState, useEffect, useCallback } from 'react'
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
  MessageSquare,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useProductionChat } from '@/contexts/ProductionChatContext'
import { followUser, unfollowUser, checkIsFollowing, checkIsMutual } from '@/features/social/services/followService'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import { UserProfileWithVisibility, MutualFriend } from '@/shared/types'
import {
  canViewProfile,
  canViewPost,
  canComment,
  canFollow,
  canSendMessage,
  getVisibleProfileFields,
  type VisibleProfileFieldsInput,
} from '@/shared/utils/visibilityUtils'
import { PostCard } from '@/features/social/components/PostCard'
import CommentsSection from '@/features/social/components/CommentsSection'
import ShareModal from '@/features/social/components/ShareModal'
import { useMembers } from '@/shared/hooks/useMembers'
import { sendNotification } from '@/shared/services/notificationService'
import { getReactionTypeFromEmoji } from '@/shared/utils/reactionUtils'

interface PostWithAuthor {
  id: string
  title: string
  content: string
  category: 'politics' | 'culture' | 'general'
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

const UserProfilePage: React.FC = () => {
  const params = useParams()
  const router = useRouter()
  const username = params?.username as string
  const { user } = useAuth()
  const { startChatWithMembers, openThread, startCall } = useProductionChat()
  const { members } = useMembers()

  const [profile, setProfile] = useState<UserProfileWithVisibility | null>(null)
  const [posts, setPosts] = useState<PostWithAuthor[]>([])
  const [mutualFriends, setMutualFriends] = useState<MutualFriend[]>([])
  const [mutualFriendsCount, setMutualFriendsCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [isFollowing, setIsFollowing] = useState(false)
  const [isMutual, setIsMutual] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showCommentsFor, setShowCommentsFor] = useState<string | null>(null)
  const [shareModalState, setShareModalState] = useState<{ open: boolean; postId: string | null }>({ open: false, postId: null })

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

      const viewerId = user?.id ?? null
      const ownerId = profileData.id
      const isOwn = viewerId === ownerId
      const mutual = !isOwn && viewerId ? await checkIsMutual(viewerId, ownerId) : false
      setIsMutual(mutual)

      const pv = profileData.profile_visibility || 'public'
      const postVis = profileData.post_visibility || 'public'
      if (!isOwn && !canViewProfile(viewerId, ownerId, pv, mutual)) {
        setPosts([])
        setLoading(false)
        return
      }

      // Fetch user posts with author for PostCard
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select(`
          *,
          author:profiles!posts_author_id_fkey(
            id,
            username,
            full_name,
            avatar_url,
            country
          )
        `)
        .eq('author_id', profileData.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(20)

      if (postsError) throw postsError

      let postsWithLikes: PostWithAuthor[] = (postsData || []).map((p) => ({
        ...p,
        author: p.author || {
          id: profileData.id,
          username: profileData.username,
          full_name: profileData.full_name,
          avatar_url: profileData.avatar_url,
          country: profileData.country,
        },
        isLiked: false,
      }))

      if (user && postsWithLikes.length > 0) {
        const { data: likesData } = await supabase
          .from('likes')
          .select('post_id')
          .eq('user_id', user.id)
          .in('post_id', postsWithLikes.map((p) => p.id))
        const likedPostIds = new Set((likesData || []).map((l) => l.post_id))
        postsWithLikes = postsWithLikes.map((p) => ({ ...p, isLiked: likedPostIds.has(p.id) }))
      }

      const canSeePost = (authorId: string) =>
        canViewPost(viewerId, authorId, postVis, mutual)
      const visiblePosts = isOwn ? postsWithLikes : postsWithLikes.filter((p) => canSeePost(p.author_id))
      setPosts(visiblePosts)

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

  const updatePostInList = useCallback((postId: string, updater: (p: PostWithAuthor) => PostWithAuthor) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? updater(p) : p)))
  }, [])

  const handleLike = useCallback(async (postId: string) => {
    if (!user) {
      toast.error('Please sign in to like posts')
      return
    }
    const post = posts.find((p) => p.id === postId)
    if (!post) return
    try {
      if (post.isLiked) {
        await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', user.id)
        updatePostInList(postId, (p) => ({ ...p, isLiked: false, likes_count: Math.max(0, p.likes_count - 1) }))
      } else {
        await supabase.from('likes').insert({ post_id: postId, user_id: user.id })
        updatePostInList(postId, (p) => ({ ...p, isLiked: true, likes_count: p.likes_count + 1 }))
      }
    } catch (e: any) {
      console.error('Error toggling like:', e)
      toast.error('Failed to update like')
    }
  }, [user, posts, updatePostInList])

  const handleComment = useCallback((postId: string) => {
    setShowCommentsFor((prev) => (prev === postId ? null : postId))
  }, [])

  const handleShare = useCallback((postId: string) => {
    setShareModalState({ open: true, postId })
  }, [])

  const handleDelete = useCallback(async (postId: string) => {
    if (!user || !profile || profile.id !== user.id) return
    try {
      await supabase.from('posts').update({ is_deleted: true }).eq('id', postId).eq('author_id', user.id)
      setPosts((prev) => prev.filter((p) => p.id !== postId))
      toast.success('Post deleted')
    } catch (e: any) {
      console.error('Error deleting post:', e)
      toast.error('Failed to delete post')
    }
  }, [user, profile])

  const handleEdit = useCallback(async (postId: string, newContent: string) => {
    try {
      await supabase.from('posts').update({ content: newContent, updated_at: new Date().toISOString() }).eq('id', postId)
      updatePostInList(postId, (p) => ({ ...p, content: newContent }))
      toast.success('Post updated')
    } catch (e: any) {
      console.error('Error updating post:', e)
      toast.error('Failed to update post')
    }
  }, [updatePostInList])

  const handleEmojiReaction = useCallback(async (postId: string, emoji: string) => {
    if (!user) {
      toast.error('Please sign in to react')
      return
    }
    const reactionType = getReactionTypeFromEmoji(emoji)
    try {
      const { data: existingReaction, error: checkError } = await supabase
        .from('post_reactions')
        .select('id, reaction_type')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .single()
      if (checkError && checkError.code !== 'PGRST116') {
        toast.error('Failed to check reaction')
        return
      }
      if (existingReaction && existingReaction.reaction_type === reactionType) {
        await supabase.from('post_reactions').delete().eq('post_id', postId).eq('user_id', user.id).eq('reaction_type', reactionType)
        updatePostInList(postId, (p) => ({ ...p, likes_count: Math.max(0, p.likes_count - 1) }))
        toast.success('Reaction removed')
        window.dispatchEvent(new CustomEvent('reaction-updated', { detail: { postId } }))
        return
      }
      if (existingReaction) {
        await supabase.from('post_reactions').update({ reaction_type: reactionType }).eq('post_id', postId).eq('user_id', user.id)
        toast.success('Reaction updated')
        window.dispatchEvent(new CustomEvent('reaction-updated', { detail: { postId } }))
        return
      }
      await supabase.from('post_reactions').insert({ post_id: postId, user_id: user.id, reaction_type: reactionType })
      const { data: currentPost } = await supabase.from('posts').select('likes_count').eq('id', postId).single()
      const newCount = currentPost ? (currentPost.likes_count || 0) + 1 : 1
      await supabase.from('posts').update({ likes_count: newCount }).eq('id', postId)
      updatePostInList(postId, (p) => ({ ...p, likes_count: newCount }))
      toast.success('Reaction saved!')
      window.dispatchEvent(new CustomEvent('reaction-updated', { detail: { postId } }))
    } catch (e: any) {
      console.error('Error handling emoji reaction:', e)
      toast.error('Something went wrong')
    }
  }, [user, updatePostInList])

  const handleSendToMembers = useCallback(async (memberIds: string[], message: string) => {
    if (!memberIds.length) {
      toast.success('No members selected')
      return
    }

    const senderName = user?.user_metadata?.full_name || user?.email || 'Someone'
    const postId = shareModalState.postId

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
  }, [user, shareModalState.postId])

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
  const viewerId = user?.id ?? null
  const canView = isOwnProfile || canViewProfile(viewerId, profile.id, profile.profile_visibility || 'public', isMutual)
  const showFollowBtn = canFollow(viewerId, profile.id, profile.allow_follows || 'everyone', isMutual)
  const showMessageBtn = canSendMessage(viewerId, profile.id, profile.allow_direct_messages || 'everyone', isMutual)
  const visibleFields = getVisibleProfileFields(profile as VisibleProfileFieldsInput, Boolean(isOwnProfile), Boolean(isMutual))
  const allowComments = profile.allow_comments ?? 'everyone'
  const canCommentOnPost = (authorId: string) =>
    isOwnProfile || canComment(viewerId, authorId, allowComments, isMutual)

  if (!canView) {
    return (
      <div className="min-h-screen bg-[#eef0f4] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md text-center">
          <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl font-bold text-gray-400">
              {profile.full_name?.charAt(0)?.toUpperCase() ?? '?'}
            </span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">This content isn&apos;t available</h1>
          <p className="text-gray-600 mb-6">
            The person who shared this content only shares it with a small group of people or the link may be broken.
          </p>
          <button
            onClick={() => router.push('/feed')}
            className="px-5 py-2.5 bg-primary-600 text-white rounded-full font-semibold hover:bg-primary-700 transition-colors"
          >
            Go to Feed
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#eef0f4] pb-24 sm:pb-8">
      <div className="max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        {/* Profile card */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-5 sm:mb-6">
          {/* Hero: centered avatar on mobile, row on desktop */}
          <div className="pt-8 sm:pt-10 pb-6 sm:pb-8 px-6 sm:px-8">
            <div className="flex flex-col items-center sm:flex-row sm:items-start gap-5 sm:gap-6">
              <div className="relative flex-shrink-0">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name}
                    className="w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover ring-4 ring-white shadow-lg"
                  />
                ) : (
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center ring-4 ring-white shadow-lg">
                    <span className="text-4xl sm:text-5xl font-bold text-gray-500">
                      {profile.full_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                {profile.is_verified && (
                  <div className="absolute bottom-0 right-0 w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center ring-2 ring-white shadow">
                    <span className="text-white text-xs font-bold">✓</span>
                  </div>
                )}
              </div>

              <div className="flex-1 w-full sm:w-auto text-center sm:text-left min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">
                  {profile.full_name}
                </h1>
                <p className="text-gray-500 text-sm mt-1">@{profile.username}</p>
                <div className="flex flex-wrap justify-center sm:justify-start items-center gap-x-4 gap-y-1 mt-3 text-sm text-gray-500">
                  {visibleFields.followersCount && (
                    <>
                      <span><span className="font-semibold text-gray-900">{profile.followers_count}</span> tapped in</span>
                      <span className="hidden sm:inline text-gray-300">·</span>
                    </>
                  )}
                  <span><span className="font-semibold text-gray-900">{profile.following_count}</span> tapping in</span>
                  <span className="hidden sm:inline text-gray-300">·</span>
                  <span><span className="font-semibold text-gray-900">{profile.posts_count}</span> posts</span>
                </div>

                {!isOwnProfile && (showFollowBtn || showMessageBtn) && (
                  <div className="flex flex-wrap justify-center sm:justify-start items-center gap-3 mt-5">
                    {showFollowBtn && (
                      <button
                        onClick={handleFollow}
                        disabled={followLoading}
                        className={`min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all disabled:opacity-50 active:scale-[0.98] ${
                          isFollowing
                            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                            : 'bg-[#F97316] text-white hover:bg-[#ea580c] shadow-sm'
                        }`}
                      >
                        {followLoading ? (
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : isFollowing ? (
                          <UserCheck className="w-4 h-4" />
                        ) : (
                          <UserPlus className="w-4 h-4" />
                        )}
                        {isFollowing ? 'Tapped In' : 'Tap In'}
                      </button>
                    )}
                    {showMessageBtn && (
                      <button
                        onClick={handleStartChat}
                        className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 transition-all active:scale-[0.98]"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Message
                      </button>
                    )}
                    {(showFollowBtn || showMessageBtn) && (
                      <div className="relative">
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu) }}
                          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200 transition-all active:scale-[0.98]"
                          aria-label="More"
                        >
                          <MoreHorizontal className="w-5 h-5" />
                        </button>
                        {showMenu && showMessageBtn && (
                          <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 z-50">
                            <button
                              onClick={() => { handleCall(false); setShowMenu(false) }}
                              className="w-full px-4 py-3 text-left text-gray-800 hover:bg-gray-50 flex items-center gap-3 text-sm font-medium"
                            >
                              <Phone className="w-4 h-4 text-gray-500" />
                              Call
                            </button>
                            <button
                              onClick={() => { handleCall(true); setShowMenu(false) }}
                              className="w-full px-4 py-3 text-left text-gray-800 hover:bg-gray-50 flex items-center gap-3 text-sm font-medium"
                            >
                              <Video className="w-4 h-4 text-gray-500" />
                              Video Call
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {isOwnProfile && (
                  <div className="mt-5">
                    <button
                      onClick={() => router.push('/profile')}
                      className="min-h-[44px] inline-flex items-center justify-center px-5 py-2.5 rounded-full text-sm font-semibold bg-gray-100 text-gray-800 hover:bg-gray-200 border border-gray-200 transition-all active:scale-[0.98]"
                    >
                      Edit Profile
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Intro block: bio, location, joined - subtle background */}
          <div className="bg-[#f7f8fa] border-t border-gray-100 px-6 sm:px-8 py-5 space-y-4">
            {profile.bio && (
              <p className="text-gray-800 text-[15px] leading-relaxed">{profile.bio}</p>
            )}
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
              {visibleFields.country && profile.country && (
                <span className="inline-flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  {profile.country}
                </span>
              )}
              {visibleFields.location && (profile as UserProfileWithVisibility).location && (
                <span className="inline-flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  {(profile as UserProfileWithVisibility).location}
                </span>
              )}
              <span className="inline-flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                Joined {formatDistanceToNow(new Date(profile.created_at), { addSuffix: true })}
              </span>
            </div>

            {user && user.id !== profile.id && visibleFields.followersList && mutualFriendsCount > 0 && (
              <div className="pt-1">
                <p className="text-sm font-medium text-gray-700 mb-3">
                  {mutualFriendsCount} mutual {mutualFriendsCount === 1 ? 'friend' : 'friends'}
                </p>
                <div className="flex items-center gap-1">
                  {mutualFriends.slice(0, 6).map((friend) => (
                    <button
                      key={friend.user_id}
                      type="button"
                      onClick={() => router.push(`/user/${friend.username}`)}
                      className="relative w-10 h-10 rounded-full ring-2 ring-[#f7f8fa] overflow-hidden hover:z-10 focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:ring-offset-2 transition-transform hover:scale-110 flex-shrink-0"
                      title={friend.full_name}
                    >
                      {friend.avatar_url ? (
                        <img
                          src={friend.avatar_url}
                          alt={friend.full_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-300 flex items-center justify-center">
                          <span className="text-sm font-semibold text-gray-600">
                            {friend.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </button>
                  ))}
                  {mutualFriendsCount > 6 && (
                    <div className="w-10 h-10 rounded-full ring-2 ring-[#f7f8fa] bg-gray-200 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-gray-600">
                      +{mutualFriendsCount - 6}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Posts section */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 sm:px-8 py-4 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">Posts</h2>
          </div>
          <div className="p-4 sm:p-6">
            {posts.length === 0 ? (
              <div className="text-center py-14 sm:py-20">
                <div className="w-16 h-16 rounded-full bg-[#f7f8fa] flex items-center justify-center mx-auto mb-5">
                  <MessageSquare className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-700 font-medium text-base">No posts yet</p>
                <p className="text-sm text-gray-500 mt-1.5 max-w-xs mx-auto">
                  {isOwnProfile ? 'Share your first post from the feed.' : "This profile doesn't have any posts yet."}
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {posts.map((post) => (
                  <React.Fragment key={post.id}>
                    <PostCard
                      post={post as Parameters<typeof PostCard>[0]['post']}
                      onLike={handleLike}
                      onComment={handleComment}
                      onShare={handleShare}
                      onDelete={user?.id === profile.id ? handleDelete : undefined}
                      onEdit={user?.id === profile.id ? handleEdit : undefined}
                      onEmojiReaction={handleEmojiReaction}
                      isPostLiked={post.isLiked}
                      canComment={canCommentOnPost(post.author_id)}
                      canFollow={showFollowBtn}
                    />
                    {showCommentsFor === post.id && (
                      <div className="mt-2">
                        <CommentsSection
                          postId={post.id}
                          isOpen={true}
                          onClose={() => setShowCommentsFor(null)}
                          canComment={canCommentOnPost(post.author_id)}
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

      {shareModalState.open && shareModalState.postId && (
        <ShareModal
          isOpen={shareModalState.open}
          onClose={() => setShareModalState({ open: false, postId: null })}
          postUrl={typeof window !== 'undefined' ? `${window.location.origin}/post/${shareModalState.postId}` : ''}
          postId={shareModalState.postId}
          members={members.map((m) => ({ id: m.id, name: m.name, avatar_url: m.avatar_url }))}
          onSendToMembers={handleSendToMembers}
        />
      )}
    </div>
  )
}

export default UserProfilePage

