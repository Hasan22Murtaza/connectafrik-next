'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  UserPlus, UserCheck, MessageCircle, Phone, Video, MoreHorizontal,
  MapPin, Calendar, Users,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useProductionChat } from '@/contexts/ProductionChatContext'
import { followUser, unfollowUser, checkIsFollowing, checkIsMutual } from '@/features/social/services/followService'
import { friendRequestService } from '@/features/social/services/friendRequestService'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import { UserProfileWithVisibility, MutualFriend } from '@/shared/types'
import {
  canViewProfile, canViewPost, canComment, canFollow, canSendMessage,
  getVisibleProfileFields, type VisibleProfileFieldsInput,
} from '@/shared/utils/visibilityUtils'
import ShareModal from '@/features/social/components/ShareModal'
import { useMembers } from '@/shared/hooks/useMembers'
import { sendNotification } from '@/shared/services/notificationService'
import { getReactionTypeFromEmoji } from '@/shared/utils/reactionUtils'
import PostsTab from './components/PostsTab'
import AboutTab from './components/AboutTab'
import PhotosTab from './components/PhotosTab'
import FriendsTab from './components/FriendsTab'
import ReelsTab from './components/ReelsTab'

interface PostWithAuthor {
  id: string; title: string; content: string
  category: 'politics' | 'culture' | 'general'
  author_id: string; created_at: string
  likes_count: number; comments_count: number; shares_count: number; views_count: number
  media_urls: string[] | null
  author: { id: string; username: string; full_name: string; avatar_url: string | null; country: string | null }
  isLiked?: boolean
}

type TabId = 'posts' | 'about' | 'photos' | 'friends' | 'reels'
type FriendStatus = 'none' | 'pending_sent' | 'pending_received' | 'friends'

const TABS: { id: TabId; label: string }[] = [
  { id: 'posts', label: 'Posts' },
  { id: 'about', label: 'About' },
  { id: 'photos', label: 'Photos' },
  { id: 'friends', label: 'Friends' },
  { id: 'reels', label: 'Reels' },
]

const fmt = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(n)
}

const isVideo = (url: string) => /\.(mp4|webm|ogg|avi|mov|wmv|flv|mkv)($|\?)/i.test(url)

const Spinner = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <div className={`${className} border-2 border-current border-t-transparent rounded-full animate-spin`} />
)

const Avatar = ({ src, name, size = 'md' }: { src?: string | null; name: string; size?: 'sm' | 'md' | 'lg' }) => {
  const sizes = { sm: 'w-7 h-7 text-[10px]', md: 'w-14 h-14 text-lg', lg: 'w-24 h-24 sm:w-32 sm:h-32 lg:w-36 lg:h-36 text-4xl sm:text-5xl' }
  const cls = sizes[size]
  return src ? (
    <img src={src} alt={name} className={`${cls} rounded-full object-cover`} />
  ) : (
    <div className={`${cls} rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center`}>
      <span className="font-bold text-gray-500">{name.charAt(0).toUpperCase()}</span>
    </div>
  )
}

const DetailRow = ({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) => (
  <div className="flex items-center gap-3 text-[15px] text-gray-700">
    <Icon className="w-5 h-5 text-gray-400 flex-shrink-0" />
    <span>{children}</span>
  </div>
)

const ProfileSkeleton = () => (
  <div className="min-h-screen bg-[#f0f2f5]">
    <div className="max-w-[940px] mx-auto bg-white shadow-sm border-b border-gray-200">
      <div className="px-4 sm:px-6 py-5">
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 items-center sm:items-start">
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gray-300 animate-pulse" />
          <div className="flex-1 space-y-3 text-center sm:text-left w-full">
            <div className="h-8 w-56 bg-gray-200 rounded animate-pulse mx-auto sm:mx-0" />
            <div className="h-4 w-44 bg-gray-200 rounded animate-pulse mx-auto sm:mx-0" />
            <div className="h-4 w-72 bg-gray-200 rounded animate-pulse mx-auto sm:mx-0" />
          </div>
        </div>
      </div>
      <div className="flex gap-2 px-4 sm:px-6 py-3 border-t border-gray-200">
        {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-8 w-16 bg-gray-200 rounded animate-pulse" />)}
      </div>
    </div>
    <div className="max-w-[940px] mx-auto px-4 mt-4 flex flex-col lg:flex-row gap-4">
      <div className="w-full lg:w-[300px]">
        <div className="bg-white rounded-lg shadow-sm p-4 space-y-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: `${90 - i * 15}%` }} />)}
        </div>
      </div>
      <div className="flex-1 space-y-4">
        <div className="bg-white rounded-lg shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
            <div className="space-y-2 flex-1">
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
              <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
          <div className="h-20 w-full bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    </div>
  </div>
)

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
  const [activeTab, setActiveTab] = useState<TabId>('posts')
  const [userFriends, setUserFriends] = useState<any[]>([])
  const [friendshipStatus, setFriendshipStatus] = useState<FriendStatus>('none')
  const [friendRequestId, setFriendRequestId] = useState<string | null>(null)
  const [friendLoading, setFriendLoading] = useState(false)

  const allPhotos = useMemo(() =>
    posts.filter((p) => p.media_urls?.length).flatMap((p) => (p.media_urls || []).map((url) => ({ url, postId: p.id }))),
    [posts]
  )

  const allVideos = useMemo(() =>
    posts.filter((p) => p.media_urls?.some(isVideo)).flatMap((p) =>
      (p.media_urls || []).filter(isVideo).map((url) => ({ url, postId: p.id, content: p.content, author: p.author }))
    ), [posts]
  )

  useEffect(() => { if (username) fetchUserProfile() }, [username])
  useEffect(() => { if (profile && user && user.id !== profile.id) checkFollowStatus() }, [profile, user])

  const fetchUserProfile = async () => {
    try {
      setLoading(true)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles').select('*').eq('username', username).single()
      if (profileError) throw profileError
      setProfile(profileData)

      const viewerId = user?.id ?? null
      const ownerId = profileData.id
      const isOwn = viewerId === ownerId
      const mutual = !isOwn && viewerId ? await checkIsMutual(viewerId, ownerId) : false
      setIsMutual(mutual)

      const friendsMap = new Map<string, any>()

      const { data: friendReqData } = await supabase
        .from('friend_requests')
        .select('*, sender:profiles!friend_requests_sender_id_profiles_fkey(id,username,full_name,avatar_url), receiver:profiles!friend_requests_receiver_id_profiles_fkey(id,username,full_name,avatar_url)')
        .or(`sender_id.eq.${ownerId},receiver_id.eq.${ownerId}`)
        .eq('status', 'accepted')
      if (friendReqData) {
        friendReqData.forEach((r: any) => {
          const f = r.sender_id === ownerId ? r.receiver : r.sender
          const friend = Array.isArray(f) ? f[0] : f
          if (friend?.id) friendsMap.set(friend.id, friend)
        })
      }

      const [{ data: followersData }, { data: followingData }] = await Promise.all([
        supabase.from('follows').select('follower_id').eq('following_id', ownerId),
        supabase.from('follows').select('following_id').eq('follower_id', ownerId),
      ])
      if (followersData && followingData) {
        const followerIds = new Set(followersData.map((f: any) => f.follower_id))
        const mutualIds = followingData.filter((f: any) => followerIds.has(f.following_id)).map((f: any) => f.following_id)
        if (mutualIds.length > 0) {
          const { data: mutualProfiles } = await supabase
            .from('profiles').select('id,username,full_name,avatar_url')
            .in('id', mutualIds)
          if (mutualProfiles) {
            mutualProfiles.forEach((p: any) => { if (!friendsMap.has(p.id)) friendsMap.set(p.id, p) })
          }
        }
      }

      setUserFriends(Array.from(friendsMap.values()))

      const pv = profileData.profile_visibility || 'public'
      const postVis = profileData.post_visibility || 'public'
      if (!isOwn && !canViewProfile(viewerId, ownerId, pv, mutual)) {
        setPosts([]); setLoading(false); return
      }

      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('*, author:profiles!posts_author_id_fkey(id,username,full_name,avatar_url,country)')
        .eq('author_id', ownerId).eq('is_deleted', false)
        .order('created_at', { ascending: false }).limit(20)
      if (postsError) throw postsError

      let postsWithLikes: PostWithAuthor[] = (postsData || []).map((p) => ({
        ...p,
        author: p.author || { id: ownerId, username: profileData.username, full_name: profileData.full_name, avatar_url: profileData.avatar_url, country: profileData.country },
        isLiked: false,
      }))

      if (user && postsWithLikes.length > 0) {
        const { data: likesData } = await supabase.from('likes').select('post_id').eq('user_id', user.id).in('post_id', postsWithLikes.map((p) => p.id))
        const likedIds = new Set((likesData || []).map((l) => l.post_id))
        postsWithLikes = postsWithLikes.map((p) => ({ ...p, isLiked: likedIds.has(p.id) }))
      }

      const canSeePost = (authorId: string) => canViewPost(viewerId, authorId, postVis, mutual)
      setPosts(isOwn ? postsWithLikes : postsWithLikes.filter((p) => canSeePost(p.author_id)))

      if (user && !isOwn) {
        await checkFollowStatus()
        await fetchMutualFriends(user.id, ownerId)
        let status = await friendRequestService.getFriendshipStatus(ownerId)
        if (status === 'none') {
          const { data: dc } = await supabase.from('friend_requests').select('sender_id,receiver_id,status')
            .or(`and(sender_id.eq.${user.id},receiver_id.eq.${ownerId}),and(sender_id.eq.${ownerId},receiver_id.eq.${user.id})`)
            .order('created_at', { ascending: false })
          if (dc?.length) {
            const acc = dc.find((r: any) => r.status === 'accepted')
            const pnd = dc.find((r: any) => r.status === 'pending')
            if (acc) status = 'friends'
            else if (pnd) status = pnd.sender_id === user.id ? 'pending_sent' : 'pending_received'
          }
        }
        setFriendshipStatus(status)
        if (status === 'pending_sent' || status === 'pending_received') {
          const { data: reqData } = await supabase.from('friend_requests').select('id')
            .or(`and(sender_id.eq.${user.id},receiver_id.eq.${ownerId}),and(sender_id.eq.${ownerId},receiver_id.eq.${user.id})`)
            .eq('status', 'pending').maybeSingle()
          if (reqData) setFriendRequestId(reqData.id)
        }
      }
    } catch (error: any) {
      console.error('Error fetching profile:', error)
      toast.error('User not found'); router.push('/feed')
    } finally { setLoading(false) }
  }

  const fetchMutualFriends = async (uid: string, tid: string) => {
    try {
      const { data: c } = await supabase.rpc('get_mutual_friends_count', { user1_id: uid, user2_id: tid })
      setMutualFriendsCount(c || 0)
      const { data: f } = await supabase.rpc('get_mutual_friends', { user1_id: uid, user2_id: tid, limit_count: 6 })
      setMutualFriends(f || [])
    } catch (e) { console.error('Mutual friends error:', e) }
  }

  const checkFollowStatus = async () => {
    if (!user || !profile) return
    try { setIsFollowing(await checkIsFollowing(user.id, profile.id)) } catch (e) { console.error(e) }
  }

  const handleFollow = async () => {
    if (!user || !profile) return
    setFollowLoading(true)
    try {
      if (isFollowing) {
        if (await unfollowUser(user.id, profile.id)) {
          setIsFollowing(false)
          setProfile((p) => p ? { ...p, followers_count: p.followers_count - 1 } : null)
          toast.success(`Untapped from ${profile.full_name}`)
        } else toast.error('Failed to untap')
      } else {
        if (await followUser(user.id, profile.id)) {
          setIsFollowing(true)
          setProfile((p) => p ? { ...p, followers_count: p.followers_count + 1 } : null)
          toast.success(`Tapped in to ${profile.full_name}`)
        } else {
          if (await checkIsFollowing(user.id, profile.id)) { setIsFollowing(true); toast.success('Already tapped in!') }
          else toast.error('Failed to tap in')
        }
      }
    } catch (e: any) { toast.error(e.message || 'Something went wrong') }
    finally { setFollowLoading(false) }
  }

  const handleFriendRequest = async () => {
    if (!profile || !user) return
    setFriendLoading(true)
    try {
      if (friendshipStatus === 'none') {
        const r = await friendRequestService.sendFriendRequest(profile.id)
        if (r.success) {
          setFriendshipStatus('pending_sent')
          const { data } = await supabase.from('friend_requests').select('id').eq('sender_id', user.id).eq('receiver_id', profile.id).eq('status', 'pending').maybeSingle()
          if (data) setFriendRequestId(data.id)
          toast.success(`Friend request sent to ${profile.full_name}`)
        } else if (r.error === 'Already friends') { setFriendshipStatus('friends'); toast.success('You are already friends!') }
        else if (r.error === 'Friend request already sent') { setFriendshipStatus('pending_sent'); toast.success('Friend request already sent') }
        else toast.error(r.error || 'Failed to send friend request')
      } else if (friendshipStatus === 'pending_sent' && friendRequestId) {
        const r = await friendRequestService.cancelFriendRequest(friendRequestId)
        if (r.success) { setFriendshipStatus('none'); setFriendRequestId(null); toast.success('Friend request cancelled') }
        else toast.error(r.error || 'Failed to cancel request')
      } else if (friendshipStatus === 'pending_received' && friendRequestId) {
        const r = await friendRequestService.acceptFriendRequest(friendRequestId)
        if (r.success) { setFriendshipStatus('friends'); setFriendRequestId(null); toast.success(`You and ${profile.full_name} are now friends!`) }
        else toast.error(r.error || 'Failed to accept request')
      } else if (friendshipStatus === 'friends') {
        const r = await friendRequestService.removeFriend(profile.id)
        if (r.success) { setFriendshipStatus('none'); toast.success(`Removed ${profile.full_name} from friends`) }
        else toast.error(r.error || 'Failed to remove friend')
      }
    } catch { toast.error('Something went wrong') }
    finally { setFriendLoading(false) }
  }

  const handleStartChat = async () => {
    if (!profile || !user) return
    try {
      const tid = await startChatWithMembers([{ id: profile.id, name: profile.full_name, avatarUrl: profile.avatar_url || undefined }], { participant_ids: [profile.id], openInDock: true })
      if (tid) { openThread(tid); toast.success(`Chat opened with ${profile.full_name}`) }
    } catch { toast.error('Failed to start chat') }
  }

  const handleCall = async (isVideoCall = false) => {
    if (!profile || !user) return
    try {
      const tid = await startChatWithMembers([{ id: profile.id, name: profile.full_name, avatarUrl: profile.avatar_url || undefined }], { participant_ids: [profile.id], openInDock: true })
      if (tid) { await startCall(tid, isVideoCall ? 'video' : 'audio'); toast.success(`${isVideoCall ? 'Video' : 'Audio'} call started`) }
      else toast.error('Failed to create chat thread')
    } catch { toast.error('Failed to start call') }
  }

  const updatePost = useCallback((id: string, fn: (p: PostWithAuthor) => PostWithAuthor) => {
    setPosts((prev) => prev.map((p) => (p.id === id ? fn(p) : p)))
  }, [])

  const handleLike = useCallback(async (postId: string) => {
    if (!user) { toast.error('Please sign in to like posts'); return }
    const post = posts.find((p) => p.id === postId)
    if (!post) return
    try {
      if (post.isLiked) {
        await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', user.id)
        updatePost(postId, (p) => ({ ...p, isLiked: false, likes_count: Math.max(0, p.likes_count - 1) }))
      } else {
        await supabase.from('likes').insert({ post_id: postId, user_id: user.id })
        updatePost(postId, (p) => ({ ...p, isLiked: true, likes_count: p.likes_count + 1 }))
      }
    } catch { toast.error('Failed to update like') }
  }, [user, posts, updatePost])

  const handleComment = useCallback((id: string) => setShowCommentsFor((p) => (p === id ? null : id)), [])
  const handleShare = useCallback((id: string) => setShareModalState({ open: true, postId: id }), [])

  const handleDelete = useCallback(async (postId: string) => {
    if (!user || !profile || profile.id !== user.id) return
    try { await supabase.from('posts').update({ is_deleted: true }).eq('id', postId).eq('author_id', user.id); setPosts((p) => p.filter((x) => x.id !== postId)); toast.success('Post deleted') }
    catch { toast.error('Failed to delete post') }
  }, [user, profile])

  const handleEdit = useCallback(async (postId: string, content: string) => {
    try { await supabase.from('posts').update({ content, updated_at: new Date().toISOString() }).eq('id', postId); updatePost(postId, (p) => ({ ...p, content })); toast.success('Post updated') }
    catch { toast.error('Failed to update post') }
  }, [updatePost])

  const handleEmojiReaction = useCallback(async (postId: string, emoji: string) => {
    if (!user) { toast.error('Please sign in to react'); return }
    const reactionType = getReactionTypeFromEmoji(emoji)
    try {
      const { data: existing, error: checkErr } = await supabase.from('post_reactions').select('id,reaction_type').eq('post_id', postId).eq('user_id', user.id).single()
      if (checkErr && checkErr.code !== 'PGRST116') { toast.error('Failed to check reaction'); return }
      if (existing?.reaction_type === reactionType) {
        await supabase.from('post_reactions').delete().eq('post_id', postId).eq('user_id', user.id).eq('reaction_type', reactionType)
        updatePost(postId, (p) => ({ ...p, likes_count: Math.max(0, p.likes_count - 1) }))
        toast.success('Reaction removed'); window.dispatchEvent(new CustomEvent('reaction-updated', { detail: { postId } })); return
      }
      if (existing) {
        await supabase.from('post_reactions').update({ reaction_type: reactionType }).eq('post_id', postId).eq('user_id', user.id)
        toast.success('Reaction updated'); window.dispatchEvent(new CustomEvent('reaction-updated', { detail: { postId } })); return
      }
      await supabase.from('post_reactions').insert({ post_id: postId, user_id: user.id, reaction_type: reactionType })
      const { data: cp } = await supabase.from('posts').select('likes_count').eq('id', postId).single()
      const nc = (cp?.likes_count || 0) + 1
      await supabase.from('posts').update({ likes_count: nc }).eq('id', postId)
      updatePost(postId, (p) => ({ ...p, likes_count: nc })); toast.success('Reaction saved!')
      window.dispatchEvent(new CustomEvent('reaction-updated', { detail: { postId } }))
    } catch { toast.error('Something went wrong') }
  }, [user, updatePost])

  const handleSendToMembers = useCallback(async (memberIds: string[], message: string) => {
    if (!memberIds.length) { toast.success('No members selected'); return }
    const name = user?.user_metadata?.full_name || user?.email || 'Someone'
    const pid = shareModalState.postId
    const results = await Promise.allSettled(
      memberIds.map((mid) => sendNotification({ user_id: mid, title: 'Post Shared With You', body: message ? `${name} shared a post with you: "${message}"` : `${name} shared a post with you`, notification_type: 'post_share', data: { type: 'post_share', post_id: pid || '', sender_id: user?.id || '', sender_name: name, message, url: `/post/${pid}` } }))
    )
    const ok = results.filter((r) => r.status === 'fulfilled' && (r as PromiseFulfilledResult<any>).value.success).length
    ok > 0 ? toast.success(`Shared with ${ok} member${ok === 1 ? '' : 's'}`) : toast.error('Failed to send notifications')
  }, [user, shareModalState.postId])

  if (loading) return <ProfileSkeleton />

  if (!profile) return (
    <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-sm p-8 max-w-md text-center">
        <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-5">
          <Users className="w-10 h-10 text-gray-300" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">User not found</h1>
        <p className="text-gray-500 mb-6">The user you&apos;re looking for doesn&apos;t exist or may have been removed.</p>
        <button onClick={() => router.push('/feed')} className="h-10 px-6 bg-[#F97316] text-white text-sm font-semibold rounded-lg hover:bg-[#ea580c] transition">Back to Feed</button>
      </div>
    </div>
  )

  const isOwnProfile = user && user.id === profile.id
  const viewerId = user?.id ?? null
  const canView = isOwnProfile || canViewProfile(viewerId, profile.id, profile.profile_visibility || 'public', isMutual)
  const showFollowBtn = canFollow(viewerId, profile.id, profile.allow_follows || 'everyone', isMutual)
  const showMessageBtn = canSendMessage(viewerId, profile.id, profile.allow_direct_messages || 'everyone', isMutual)
  const visibleFields = getVisibleProfileFields(profile as VisibleProfileFieldsInput, Boolean(isOwnProfile), Boolean(isMutual))
  const canCommentOnPost = (authorId: string) => isOwnProfile || canComment(viewerId, authorId, profile.allow_comments ?? 'everyone', isMutual)

  if (!canView) return (
    <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md text-center">
        <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl font-bold text-gray-400">{profile.full_name?.charAt(0)?.toUpperCase() ?? '?'}</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">This content isn&apos;t available</h1>
        <p className="text-gray-600 mb-6">This person only shares content with a small group of people, or the link may be broken.</p>
        <button onClick={() => router.push('/feed')} className="px-5 py-2.5 bg-[#F97316] text-white rounded-full font-semibold hover:bg-[#ea580c] transition">Go to Feed</button>
      </div>
    </div>
  )

  const friendBtnConfig: Record<FriendStatus, { label: string; icon: React.ElementType; cls: string }> = {
    friends: { label: 'Friends', icon: UserCheck, cls: 'bg-green-100 text-green-800 hover:bg-green-200' },
    pending_sent: { label: 'Request Sent', icon: UserCheck, cls: 'bg-gray-100 text-gray-600 hover:bg-gray-200' },
    pending_received: { label: 'Accept Request', icon: UserPlus, cls: 'bg-[#1b74e4] text-white hover:bg-[#1a6ed8]' },
    none: { label: 'Add Friend', icon: UserPlus, cls: 'bg-[#e4e6eb] text-gray-900 hover:bg-[#d8dadf]' },
  }
  const fb = friendBtnConfig[friendshipStatus]

  const btnBase = 'inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md text-sm font-semibold transition-colors'
  const btnGray = `${btnBase} bg-[#e4e6eb] text-gray-900 hover:bg-[#d8dadf]`

  return (
    <div className="min-h-screen bg-[#f0f2f5] pb-20 sm:pb-8">
      <div className="max-w-[940px] mx-auto bg-white shadow-sm">
        <div className="px-4 sm:px-6 pt-4 pb-3 sm:py-5">
          <div className="flex flex-col items-center sm:flex-row sm:items-start gap-3 sm:gap-5">
            <div className="flex-shrink-0">
              <div className="rounded-full p-[3px] bg-gradient-to-tr from-[#F97316] via-[#16a34a] to-[#F97316]">
                <div className="border-[3px] border-white rounded-full">
                  <Avatar src={profile.avatar_url} name={profile.full_name} size="lg" />
                </div>
              </div>
            </div>

            <div className="flex-1 min-w-0 text-center sm:text-left">
              <div className="flex flex-wrap items-baseline gap-x-2 justify-center sm:justify-start">
                <h1 className="text-[22px] sm:text-[28px] lg:text-[32px] font-bold text-gray-900 leading-tight">{profile.full_name}</h1>
                <div className="flex items-center gap-1">
                  {profile.is_verified && (
                    <div className="w-[18px] h-[18px] bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-[9px] font-bold">{'\u2713'}</span>
                    </div>
                  )}
                  <span className="text-gray-500 text-sm sm:text-base">@{profile.username}</span>
                </div>
              </div>

              <p className="mt-0.5 text-[14px] sm:text-[15px] text-gray-600">
                <span className="font-semibold text-gray-900">{fmt(profile.following_count)}</span> tapping in
              </p>

              {profile.bio && <p className="mt-1 text-[14px] sm:text-[15px] text-gray-700 leading-snug line-clamp-1 sm:line-clamp-2 max-w-xl">{profile.bio}</p>}

              {user && user.id !== profile.id && visibleFields.followersList && mutualFriendsCount > 0 && (
                <div className="flex items-center justify-center sm:justify-start mt-1.5 gap-2">
                  <div className="flex -space-x-1.5">
                    {mutualFriends.slice(0, 3).map((f) => (
                      <div key={f.user_id} className="w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 border-white overflow-hidden">
                        {f.avatar_url
                          ? <img src={f.avatar_url} alt={f.full_name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full bg-gray-300 flex items-center justify-center"><span className="text-[9px] font-semibold text-gray-600">{f.full_name.charAt(0).toUpperCase()}</span></div>
                        }
                      </div>
                    ))}
                  </div>
                  <span className="text-[12px] sm:text-[13px] text-gray-500">{mutualFriendsCount} mutual {mutualFriendsCount === 1 ? 'friend' : 'friends'}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 mt-3 sm:hidden">
            {isOwnProfile ? (
              <button onClick={() => router.push('/profile')} className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-md text-[13px] font-semibold whitespace-nowrap bg-[#e4e6eb] text-gray-900 active:bg-[#d8dadf] transition">Edit Profile</button>
            ) : (
              <>
                {showMessageBtn && (
                  <button onClick={handleStartChat} className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-md text-[13px] font-semibold whitespace-nowrap bg-[#e4e6eb] text-gray-900 active:bg-[#d8dadf] transition">
                    <MessageCircle className="w-3.5 h-3.5" />Message
                  </button>
                )}
                {showFollowBtn && (
                  <button onClick={handleFollow} disabled={followLoading} className={`flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-md text-[13px] font-semibold whitespace-nowrap disabled:opacity-50 transition ${isFollowing ? 'bg-[#e4e6eb] text-gray-900 active:bg-[#d8dadf]' : 'bg-[#F97316] text-white active:bg-[#ea580c]'}`}>
                    {followLoading ? <Spinner className="w-3.5 h-3.5" /> : isFollowing ? <UserCheck className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                    {isFollowing ? 'Tapped In' : 'Tap In'}
                  </button>
                )}
                <button onClick={handleFriendRequest} disabled={friendLoading} className={`flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-md text-[13px] font-semibold whitespace-nowrap disabled:opacity-50 transition ${fb.cls}`}>
                  {friendLoading ? <Spinner className="w-3.5 h-3.5" /> : <fb.icon className="w-3.5 h-3.5" />}{fb.label}
                </button>
                {showMessageBtn && (
                  <div className="relative flex-shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu) }} className="flex items-center justify-center w-9 h-9 rounded-md bg-[#e4e6eb] text-gray-600 active:bg-[#d8dadf] transition" aria-label="More">
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                    {showMenu && (
                      <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50">
                        <button onClick={() => { handleCall(false); setShowMenu(false) }} className="w-full px-4 py-2.5 text-left text-gray-800 hover:bg-gray-100 flex items-center gap-3 text-sm font-medium"><Phone className="w-4 h-4 text-gray-500" />Call</button>
                        <button onClick={() => { handleCall(true); setShowMenu(false) }} className="w-full px-4 py-2.5 text-left text-gray-800 hover:bg-gray-100 flex items-center gap-3 text-sm font-medium"><Video className="w-4 h-4 text-gray-500" />Video Call</button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <hr className="border-gray-200" />

        <div className="flex items-center justify-between px-2 sm:px-4">
          <div className="flex items-center overflow-x-auto scrollbar-hide flex-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 sm:px-4 py-3 text-[13px] sm:text-[15px] font-semibold border-b-[3px] transition-colors whitespace-nowrap ${
                  activeTab === tab.id ? 'text-[#F97316] border-[#F97316]' : 'text-gray-500 border-transparent hover:bg-gray-50 rounded-t-md'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="hidden sm:flex items-center gap-2 flex-shrink-0 py-1.5">
            {isOwnProfile ? (
              <button onClick={() => router.push('/profile')} className={btnGray}>Edit Profile</button>
            ) : (
              <>
                {showMessageBtn && <button onClick={handleStartChat} className={btnGray}><MessageCircle className="w-4 h-4" />Message</button>}
                {showFollowBtn && (
                  <button onClick={handleFollow} disabled={followLoading} className={`${btnBase} disabled:opacity-50 ${isFollowing ? 'bg-[#e4e6eb] text-gray-900 hover:bg-[#d8dadf]' : 'bg-[#F97316] text-white hover:bg-[#ea580c]'}`}>
                    {followLoading ? <Spinner /> : isFollowing ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                    {isFollowing ? 'Tapped In' : 'Tap In'}
                  </button>
                )}
                <button onClick={handleFriendRequest} disabled={friendLoading} className={`${btnBase} disabled:opacity-50 ${fb.cls}`}>
                  {friendLoading ? <Spinner /> : <fb.icon className="w-4 h-4" />}{fb.label}
                </button>
                {showMessageBtn && (
                  <div className="relative flex-shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu) }} className="flex items-center justify-center w-9 h-9 rounded-md bg-[#e4e6eb] text-gray-600 hover:bg-[#d8dadf] transition" aria-label="More">
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                    {showMenu && (
                      <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50">
                        <button onClick={() => { handleCall(false); setShowMenu(false) }} className="w-full px-4 py-2.5 text-left text-gray-800 hover:bg-gray-100 flex items-center gap-3 text-sm font-medium"><Phone className="w-4 h-4 text-gray-500" />Call</button>
                        <button onClick={() => { handleCall(true); setShowMenu(false) }} className="w-full px-4 py-2.5 text-left text-gray-800 hover:bg-gray-100 flex items-center gap-3 text-sm font-medium"><Video className="w-4 h-4 text-gray-500" />Video Call</button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-[940px] mx-auto mt-3 sm:mt-4">
        <div className="flex flex-col lg:flex-row gap-0 sm:gap-4">

          <div className={`w-full lg:w-[300px] flex-shrink-0 space-y-2 sm:space-y-4 lg:sticky lg:top-4 lg:self-start ${activeTab === 'posts' ? 'hidden lg:block' : activeTab === 'about' || activeTab === 'photos' || activeTab === 'friends' || activeTab === 'reels' ? 'hidden lg:block' : ''}`}>
            <div className="bg-white sm:rounded-lg shadow-sm p-4">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-3">Personal details</h2>
              {profile.bio && <p className="text-sm text-gray-700 text-center leading-relaxed mb-3 pb-3 border-b border-gray-200">{profile.bio}</p>}
              <div className="space-y-2.5">
                {visibleFields.country && profile.country && <DetailRow icon={MapPin}>From <span className="font-semibold">{profile.country}</span></DetailRow>}
                {visibleFields.location && (profile as UserProfileWithVisibility).location && <DetailRow icon={MapPin}>Lives in <span className="font-semibold">{(profile as UserProfileWithVisibility).location}</span></DetailRow>}
                <DetailRow icon={Calendar}><span suppressHydrationWarning>Joined {formatDistanceToNow(new Date(profile.created_at), { addSuffix: true })}</span></DetailRow>
                <DetailRow icon={Users}><span className="font-semibold">{profile.posts_count}</span> posts</DetailRow>
              </div>
              <button onClick={() => setActiveTab('about')} className="w-full mt-3 py-2 text-sm font-semibold text-gray-600 bg-[#e4e6eb] hover:bg-[#d8dadf] rounded-md transition">See more details</button>
            </div>

            {user && user.id !== profile.id && visibleFields.followersList && mutualFriendsCount > 0 && (
              <div className="bg-white sm:rounded-lg shadow-sm p-4">
                <h2 className="text-base sm:text-lg font-bold text-gray-900">Friends</h2>
                <p className="text-[13px] text-gray-500 mb-3">{mutualFriendsCount} mutual {mutualFriendsCount === 1 ? 'friend' : 'friends'}</p>
                <div className="grid grid-cols-3 gap-2">
                  {mutualFriends.slice(0, 6).map((f) => (
                    <button key={f.user_id} onClick={() => router.push(`/user/${f.username}`)} className="text-left group focus:outline-none">
                      <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                        {f.avatar_url
                          ? <img src={f.avatar_url} alt={f.full_name} className="w-full h-full object-cover group-hover:brightness-95 transition" />
                          : <div className="w-full h-full flex items-center justify-center bg-gray-200 group-hover:bg-gray-300 transition"><span className="text-lg font-semibold text-gray-500">{f.full_name.charAt(0).toUpperCase()}</span></div>
                        }
                      </div>
                      <p className="text-[12px] sm:text-[13px] font-medium text-gray-900 truncate mt-1 group-hover:underline">{f.full_name}</p>
                    </button>
                  ))}
                </div>
                {mutualFriendsCount > 6 && <p onClick={() => setActiveTab('friends')} className="text-sm text-[#F97316] text-center mt-3 hover:underline cursor-pointer">See all mutual friends</p>}
              </div>
            )}

            {allPhotos.length > 0 && (
              <div className="bg-white sm:rounded-lg shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base sm:text-lg font-bold text-gray-900">Photos</h2>
                  <button onClick={() => setActiveTab('photos')} className="text-sm text-[#F97316] hover:underline font-medium">See all</button>
                </div>
                <div className="grid grid-cols-3 gap-1 rounded-lg overflow-hidden">
                  {allPhotos.slice(0, 9).map((p, i) => (
                    <div key={`sp-${p.postId}-${i}`} className="aspect-square bg-gray-100 cursor-pointer hover:brightness-90 transition overflow-hidden" onClick={() => setActiveTab('photos')}>
                      <img src={p.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            {activeTab === 'posts' && (
              <PostsTab
                posts={posts}
                isOwnProfile={Boolean(isOwnProfile)}
                userId={user?.id}
                profileId={profile.id}
                showCommentsFor={showCommentsFor}
                canCommentOnPost={canCommentOnPost}
                canFollow={showFollowBtn}
                onLike={handleLike}
                onComment={handleComment}
                onShare={handleShare}
                onDelete={handleDelete}
                onEdit={handleEdit}
                onEmojiReaction={handleEmojiReaction}
                onCloseComments={() => setShowCommentsFor(null)}
              />
            )}

            {activeTab === 'about' && (
              <AboutTab profile={profile} visibleFields={visibleFields} />
            )}

            {activeTab === 'photos' && (
              <PhotosTab photos={allPhotos} isOwnProfile={Boolean(isOwnProfile)} />
            )}

            {activeTab === 'friends' && (
              <FriendsTab friends={userFriends} isOwnProfile={Boolean(isOwnProfile)} />
            )}

            {activeTab === 'reels' && (
              <ReelsTab videos={allVideos} isOwnProfile={Boolean(isOwnProfile)} />
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
