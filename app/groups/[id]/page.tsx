'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  Users,
  MessageCircle,
  Shield,
  Globe,
  Lock,
  MapPin,
  Target,
  Tag,
  Plus,
  Edit,
  UserPlus,
  FileText,
  Calendar,
  Images,
  Folder,
  User,
  Clock,
  Flag,
} from '@/shared/icons'
import { IoMdShareAlt } from "react-icons/io";
import { useAuth } from '@/contexts/AuthContext'
import { useGroups } from '@/shared/hooks/useGroups'
import { useGroupChat } from '@/shared/hooks/useGroupChat'
import { useGroupPosts } from '@/shared/hooks/useGroupPosts'
import { Group } from '@/shared/types'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import { apiClient } from '@/lib/api-client'
import { useEmojiReaction } from '@/shared/hooks/useEmojiReaction'
import GroupMembersList from '@/features/groups/components/GroupMembersList'
import GroupJoinRequestsList from '@/features/groups/components/GroupJoinRequestsList'
import GroupComplaintsList from '@/features/groups/components/GroupComplaintsList'
import InviteFriendsModal, { InviteSentResult } from '@/features/groups/components/InviteFriendsModal'
import CreateGroupPost from '@/features/groups/components/CreateGroupPost'
import GroupPostCard from '@/features/groups/components/GroupPostCard'
import CreateGroupEventModal from '@/features/groups/components/CreateGroupEventModal'
import GroupEventsList from '@/features/groups/components/GroupEventsList'
import GroupMediaGallery from '@/features/groups/components/GroupMediaGallery'
import GroupFilesList from '@/features/groups/components/GroupFilesList'
import ShareModal from '@/features/social/components/ShareModal'
import { useMembers } from '@/shared/hooks/useMembers'
import { sendNotification } from '@/shared/services/notificationService'
import { useGroupEvents } from '@/shared/hooks/useGroupEvents'
import { getCategoryInfoLarge } from '@/shared/utils/groupUtils'
import {
  canApproveGroupJoinRequests,
  canEditGroupSettings,
  canModerateGroupContent,
  canViewGroupComplaints,
  isGroupStaffRole,
} from '@/lib/groups/roles'
import { CiViewTable } from "react-icons/ci";
import {
  useFeedShimmerCount,
  GroupPostsFeedShimmer,
  GroupDetailPageShimmer,
} from '@/shared/components/ui/ShimmerLoaders'
import { useConfirmDialog } from '@/shared/components/ui/ConfirmDialog'

type GroupFileItem = {
  id: string
  url: string
  name: string
  type: string
  created_at: string
  post: {
    id: string
    title: string
  }
  author?: {
    id: string
    username?: string
    full_name?: string
    avatar_url?: string | null
  } | null
}

type GroupMediaItem = {
  id: string
  url: string
  type: 'image' | 'video'
  created_at: string
  author?: {
    id: string
    username?: string
    full_name?: string
    avatar_url?: string | null
  } | null
}

type GroupTab = 'posts' | 'events' | 'media' | 'files' | 'about' | 'members' | 'requests' | 'complaints'

const GroupDetailPage: React.FC = () => {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const groupId = params?.id as string
  const postQueryParam = searchParams?.get('post')
  const tabQueryParam = searchParams?.get('tab')
  const { user, loading: authLoading } = useAuth()
  const { confirm, dialog } = useConfirmDialog()
  const { fetchGroupById, joinGroup, leaveGroup } = useGroups()
  const { openGroupChat } = useGroupChat()
  const { 
    posts: groupPosts, 
    loading: postsLoading, 
    createGroupPost, 
    toggleLike, 
    recordShare,
    deletePost, 
    updatePost,
    moderatePost,
  } = useGroupPosts(groupId || '')
  
  const [group, setGroup] = useState<Group | null>(null)
  const [loading, setLoading] = useState(true)
  const [isJoining, setIsJoining] = useState(false)
  const [activeTab, setActiveTab] = useState<GroupTab>(() => {
    if (tabQueryParam === 'requests' || tabQueryParam === 'members' || tabQueryParam === 'complaints') return tabQueryParam
    return 'posts'
  })
  const [visitedTabs, setVisitedTabs] = useState<Set<GroupTab>>(() => new Set(['posts', activeTab]))
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showCreateEventModal, setShowCreateEventModal] = useState(false)
  const [showCommentsFor, setShowCommentsFor] = useState<string | null>(null)
  const [isSticky, setIsSticky] = useState(false)
  const [mediaItems, setMediaItems] = useState<GroupMediaItem[]>([])
  const [files, setFiles] = useState<GroupFileItem[]>([])
  const [mediaLoading, setMediaLoading] = useState(false)
  const [filesLoading, setFilesLoading] = useState(false)
  const [membersRefreshKey, setMembersRefreshKey] = useState(0)
  const [shareModalState, setShareModalState] = useState<{ open: boolean; postId: string | null }>({ open: false, postId: null })
  const { members } = useMembers(shareModalState.open)
  const feedShimmerCount = useFeedShimmerCount()

  const {
    events,
    loading: eventsLoading,
    createEvent,
    toggleAttendance,
    deleteEvent,
  } = useGroupEvents(groupId || '', visitedTabs.has('events'))

  useEffect(() => {
    // Wait for auth to finish loading before fetching group
    if (groupId ) {
      fetchGroup()
    }
  }, [groupId])

  // Auto-open comments when ?post= query param is present
  useEffect(() => {
    if (postQueryParam && !postsLoading && groupPosts.length > 0) {
      setShowCommentsFor(postQueryParam)
      setActiveTab('posts')
    }
  }, [postQueryParam, postsLoading, groupPosts.length])

  useEffect(() => {
    if (tabQueryParam === 'requests' || tabQueryParam === 'members') {
      setActiveTab(tabQueryParam)
      setVisitedTabs((prev) => {
        if (prev.has(tabQueryParam)) return prev
        const next = new Set(prev)
        next.add(tabQueryParam)
        return next
      })
    }
  }, [tabQueryParam])

  useEffect(() => {
    const handleScroll = () => {
      setIsSticky(window.scrollY > 200)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (!groupId || activeTab !== 'media') return
    fetchGroupMedia({ silent: mediaItems.length > 0 })
  }, [groupId, activeTab, user?.id])

  useEffect(() => {
    if (!groupId || activeTab !== 'files') return
    fetchGroupFiles({ silent: files.length > 0 })
  }, [groupId, activeTab, user?.id])

  const fetchGroup = async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setLoading(true)
      const groupData = await fetchGroupById(groupId)
      if (!groupData) {
        toast.error('Group not found')
        router.push('/groups')
        return
      }
      setGroup(groupData)
    } catch (error) {
      console.error('Error fetching group:', error)
      toast.error('Failed to load group')
      if (!opts?.silent) router.push('/groups')
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }

  const fetchGroupMedia = async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setMediaLoading(true)
      const res = await apiClient.get<{ data: GroupMediaItem[] }>(`/api/groups/${groupId}/media`)
      setMediaItems(res.data || [])
    } catch (error: unknown) {
      console.error('Error fetching group media:', error)
      if (!opts?.silent) {
        setMediaItems([])
        const message = error instanceof Error ? error.message : 'Failed to load group media'
        toast.error(message)
      }
    } finally {
      setMediaLoading(false)
    }
  }

  const fetchGroupFiles = async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setFilesLoading(true)
      const res = await apiClient.get<{ data: GroupFileItem[] }>(`/api/groups/${groupId}/files`)
      setFiles(res.data || [])
    } catch (error: unknown) {
      console.error('Error fetching group files:', error)
      if (!opts?.silent) {
        setFiles([])
        const message = error instanceof Error ? error.message : 'Failed to load group files'
        toast.error(message)
      }
    } finally {
      setFilesLoading(false)
    }
  }

  const refreshMediaAndFiles = useCallback(() => {
    if (visitedTabs.has('media')) {
      fetchGroupMedia({ silent: true })
    }
    if (visitedTabs.has('files')) {
      fetchGroupFiles({ silent: true })
    }
  }, [visitedTabs, groupId])

  const patchGroup = useCallback((updates: Partial<Group>) => {
    setGroup((prev) => (prev ? { ...prev, ...updates } : prev))
  }, [])

  const handleJoinGroup = async () => {
    if (!user || !group) return

    setIsJoining(true)
    try {
      const result = await joinGroup(group.id)
      const isPending = Boolean(result?.pending || result?.membership?.status === 'pending')
      patchGroup({
        member_count: isPending ? group.member_count : (result?.member_count ?? group.member_count + 1),
        membership: result?.membership
          ? {
              id: result.membership.id,
              group_id: group.id,
              user_id: user.id,
              role: result.membership.role || 'member',
              status: result.membership.status || (isPending ? 'pending' : 'active'),
              joined_at: result.membership.joined_at || new Date().toISOString(),
              updated_at: result.membership.updated_at || new Date().toISOString(),
            }
          : {
              id: 'temp',
              group_id: group.id,
              user_id: user.id,
              role: 'member',
              status: isPending ? 'pending' : 'active',
              joined_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
      })
      if (!isPending) {
        setMembersRefreshKey((key) => key + 1)
      }
    } catch {
      // Error handling is done in the hook
    } finally {
      setIsJoining(false)
    }
  }

  const handleLeaveGroup = async () => {
    if (!user || !group) return

    const confirmed = await confirm({
      title: 'Leave group',
      message: 'Are you sure you want to leave this group?',
      confirmLabel: 'Leave',
    })
    if (!confirmed) return

    setIsJoining(true)
    try {
      const result = await leaveGroup(group.id)
      patchGroup({
        member_count: result?.member_count ?? Math.max(0, group.member_count - 1),
        membership: undefined,
      })
      setMembersRefreshKey((key) => key + 1)
      if (activeTab === 'requests' || activeTab === 'complaints') {
        setActiveTab('about')
      }
    } catch {
      // Error handling is done in the hook
    } finally {
      setIsJoining(false)
    }
  }

  const handleCreatePost = async (postData: {
    title: string
    content: string
    post_type: 'discussion' | 'goal_update' | 'announcement' | 'event' | 'resource'
    media_urls?: string[]
    background_id?: string | null
  }) => {
    if (!user || !group) return

    try {
      await createGroupPost(postData)
      if (postData.media_urls && postData.media_urls.length > 0) {
        refreshMediaAndFiles()
      }
    } catch {
      // Error handling is done in the hook
    }
  }

  const handleDeletePost = async (postId: string) => {
    try {
      await deletePost(postId)
      refreshMediaAndFiles()
    } catch {
      // Error handling is done in the hook
    }
  }

  const handleInviteSent = (result: InviteSentResult) => {
    if (typeof result.member_count === 'number') {
      patchGroup({ member_count: result.member_count })
    }
    if (result.added_count > 0 || (result.approved_count ?? 0) > 0) {
      setMembersRefreshKey((key) => key + 1)
    }
  }

  const handleJoinRequestsChanged = (info: { member_count?: number; approved: boolean }) => {
    setGroup((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        pending_join_count: Math.max(0, (prev.pending_join_count ?? 1) - 1),
        member_count:
          typeof info.member_count === 'number'
            ? info.member_count
            : info.approved
              ? prev.member_count + 1
              : prev.member_count,
      }
    })
    if (info.approved) {
      setMembersRefreshKey((key) => key + 1)
    }
  }

  const handleMembersChanged = (info: { member_count?: number }) => {
    if (typeof info.member_count === 'number') {
      patchGroup({ member_count: info.member_count })
    } else {
      patchGroup({ member_count: Math.max(0, (group?.member_count ?? 1) - 1) })
    }
  }

  const handleComment = (postId: string) => {
    setShowCommentsFor(postId)
  }

  const handleShare = (postId: string) => {
    setShareModalState({ open: true, postId })
  }

  const handleSendToMembers = async (memberIds: string[], message: string) => {
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
            ? `${senderName} shared a group post with you: "${message}"`
            : `${senderName} shared a group post with you`,
          notification_type: 'post_share',
          data: {
            type: 'post_share',
            post_id: postId || '',
            group_id: groupId,
            sender_id: user?.id || '',
            sender_name: senderName,
            message,
            url: `/groups/${groupId}?post=${postId}`,
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

  const shareUrl = useMemo(() => {
    if (!shareModalState.postId) return ''
    if (typeof window === 'undefined') return `/groups/${groupId}?post=${shareModalState.postId}`
    return `${window.location.origin}/groups/${groupId}?post=${shareModalState.postId}`
  }, [shareModalState.postId, groupId])

  const handleEmojiReaction = useEmojiReaction({
    eventName: 'group-reaction-updated',
    reactionEndpoint: (postId: string) => `/api/groups/${groupId}/posts/${postId}/reactions`,
  })

  const handleShareGroup = async (groupid: string) => {
    const shareUrl = `${window.location.origin}/groups/${groupid}`
    try {
      if (navigator.share) {
        await navigator.share({ title: group?.name || 'Group', url: shareUrl })
      } else {
        await navigator.clipboard.writeText(shareUrl)
        toast.success('Link copied to clipboard!')
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        try {
          const textarea = document.createElement('textarea')
          textarea.value = shareUrl
          textarea.style.position = 'fixed'
          textarea.style.opacity = '0'
          document.body.appendChild(textarea)
          textarea.select()
          document.execCommand('copy')
          document.body.removeChild(textarea)
          toast.success('Link copied to clipboard!')
        } catch {
          toast.error('Failed to copy link')
        }
      }
    }
  }

  const handleTabChange = useCallback((tab: GroupTab) => {
    setActiveTab(tab)
    setVisitedTabs((prev) => {
      if (prev.has(tab)) return prev
      const next = new Set(prev)
      next.add(tab)
      return next
    })
  }, [])

  if (authLoading || loading) {
    return <GroupDetailPageShimmer />
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Group not found</p>
          <button onClick={() => router.push('/groups')} className="btn-primary">
            Back to Groups
          </button>
        </div>
      </div>
    )
  }

  const isMember = group.membership?.status === 'active'
  const isPending = group.membership?.status === 'pending'
  const isInvited = group.membership?.status === 'invited'
  const viewerRole = group.membership?.role
  const isAdmin = isMember && canEditGroupSettings(viewerRole)
  const canManageJoinRequests = isMember && canApproveGroupJoinRequests(viewerRole)
  const canModerateContent = isMember && canModerateGroupContent(viewerRole)
  const canViewComplaints = isMember && canViewGroupComplaints(viewerRole)
  const isPostingRestricted = Boolean(group.membership?.posting_restricted) && !isGroupStaffRole(viewerRole)
  const pendingJoinCount = group.pending_join_count ?? 0
  const pendingReportCount = group.pending_report_count ?? 0
  const pendingPosts = canModerateContent
    ? groupPosts.filter((post) => post.moderation_status === 'pending')
    : []
  const feedPosts = canModerateContent
    ? groupPosts.filter((post) => post.moderation_status !== 'pending' && post.moderation_status !== 'rejected')
    : groupPosts.filter((post) => post.moderation_status !== 'rejected')
  const categoryInfo = getCategoryInfoLarge(group.category)

  return (
    <div className="min-h-screen max-w-full 2xl:max-w-screen-2xl mx-auto">
      {/* Banner */}
      <div className="relative">
        {group.banner_url ? (
          <div className="w-full sm:h-80 h-50  bg-gray-200">
            <img
              src={group.banner_url}
              alt={group.name}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className={`w-full sm:h-80 h-50 flex items-center justify-center ${categoryInfo.color}`}>
            <span className="text-6xl">{categoryInfo.icon}</span>
          </div>
        )}
      </div>

      {/* Sticky Header */}
      <div className={`bg-white border-b border-gray-200 transition-all duration-200 ${
        isSticky ? 'sticky top-0 z-40 shadow-sm' : ''
      }`}>
        <div className="px-4">
          <div className="flex sm:items-center items-start justify-between py-3">
            {/* Group Name & Info */}
            <div className="flex items-center gap-4">
              <div>
                <h1 className="sm:text-xl text-md font-bold text-gray-900">{group.name}</h1>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>{group.member_count} members</span>
                  <span>•</span>
                 <span className="flex items-center gap-1">
                  {group.is_public ? <Globe size={16} /> : <User size={16} />}
                  {group.is_public ? "Public" : "Private"}
                </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center  gap-2 ">
              {isMember ? (
                <>
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="btn-primary flex items-center gap-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span className='hidden sm:block'>Invite</span>
                  </button>
                  <button
                    onClick={() => openGroupChat(group.id, group.name)}
                    className="btn-primary  flex items-center justify-center gap-2"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span className='hidden sm:block'>Group Chat</span>
                  </button>
                   <button
                    onClick={() => handleShareGroup(group.id)}
                    className="btn-secondary  flex items-center justify-center gap-2"
                  >
                    <IoMdShareAlt className="w-4 h-4" />
                    <span className='hidden sm:block'>share group</span>
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => router.push(`/groups/${group.id}/edit`)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors flex items-center gap-2"
                    >
                      <Edit className="w-4 h-4" />
                      Manage
                    </button>
                  )}
                </>
              ) : isInvited ? (
                <button
                  onClick={handleJoinGroup}
                  disabled={isJoining}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
                >
                  {isJoining ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Accepting...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Accept Invitation</span>
                    </>
                  )}
                </button>
              ) : isPending ? (
                <button
                  disabled
                  className="px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg cursor-default flex items-center gap-2"
                >
                  <Clock className="w-4 h-4" />
                  <span>Waiting for Approval</span>
                </button>
              ) : user ? (
                <button
                  onClick={handleJoinGroup}
                  disabled={isJoining}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
                >
                  {isJoining ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      {group.is_public === false ? 'Requesting...' : 'Joining...'}
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Join Group
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={() => router.push('/signin')}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Login to Join
                </button>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-t border-gray-200 overflow-x-auto  scrollbar-hide">
            <button
              onClick={() => handleTabChange('posts')}
              className={`px-4 py-3 font-medium transition-colors border-b-2 shrink-0  ${
                activeTab === 'posts'
                  ? 'text-primary-600 border-primary-600'
                  : 'text-gray-600 border-transparent hover:text-gray-600 hover:bg-gray-50'
              }`}
            >
              Posts
            </button>
           
            <button
              onClick={() => handleTabChange('about')}
              className={`px-4 py-3 font-medium transition-colors border-b-2 shrink-0  ${
                activeTab === 'about'
                  ? 'text-primary-600 border-primary-600'
                  : 'text-gray-600 border-transparent hover:text-gray-600 hover:bg-gray-50'
              }`}
            >
              About
            </button>

            <button
              onClick={() => handleTabChange('members')}
              className={`px-4 py-3 font-medium transition-colors border-b-2 shrink-0  ${
                activeTab === 'members'
                  ? 'text-primary-600 border-primary-600'
                  : 'text-gray-600 border-transparent hover:text-gray-600 hover:bg-gray-50'
              }`}
            >
              Members ({group.member_count})
            </button>

            {canManageJoinRequests && (group.is_public === false || pendingJoinCount > 0) && (
              <button
                onClick={() => handleTabChange('requests')}
                className={`px-4 py-3 font-medium transition-colors border-b-2 shrink-0  ${
                  activeTab === 'requests'
                    ? 'text-primary-600 border-primary-600'
                    : 'text-gray-600 border-transparent hover:text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  Requests
                  {pendingJoinCount > 0 && (
                    <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-primary-600 text-white text-xs flex items-center justify-center">
                      {pendingJoinCount}
                    </span>
                  )}
                </span>
              </button>
            )}

            {canViewComplaints && (
              <button
                onClick={() => handleTabChange('complaints')}
                className={`px-4 py-3 font-medium transition-colors border-b-2 shrink-0  ${
                  activeTab === 'complaints'
                    ? 'text-primary-600 border-primary-600'
                    : 'text-gray-600 border-transparent hover:text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  Complaints
                  {pendingReportCount > 0 && (
                    <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-600 text-white text-xs flex items-center justify-center">
                      {pendingReportCount}
                    </span>
                  )}
                </span>
              </button>
            )}

            <button
              onClick={() => handleTabChange('events')}
              className={`px-4 py-3 font-medium transition-colors border-b-2 shrink-0  ${
                activeTab === 'events'
                  ? 'text-primary-600 border-primary-600'
                  : 'text-gray-600 border-transparent hover:text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Events
              </span>
            </button>

            <button
              onClick={() => handleTabChange('media')}
              className={`px-4 py-3 font-medium transition-colors border-b-2 shrink-0  ${
                activeTab === 'media'
                  ? 'text-primary-600 border-primary-600'
                  : 'text-gray-600 border-transparent hover:text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="flex items-center gap-2">
                <Images className="w-4 h-4" />
                Media
              </span>
            </button>

            <button
              onClick={() => handleTabChange('files')}
              className={`px-4 py-3 font-medium transition-colors border-b-2 shrink-0  ${
                activeTab === 'files'
                  ? 'text-primary-600 border-primary-600'
                  : 'text-gray-600 border-transparent hover:text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="flex items-center gap-2">
                <Folder className="w-4 h-4" />
                Files
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="py-6 px-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
       
          {/* Center Content */}
          <div className="lg:col-span-7">
            {visitedTabs.has('posts') && (
              <div className={activeTab === 'posts' ? 'space-y-4' : 'hidden'}>
                {/* Create Post */}
                {isMember && !isPostingRestricted && (
                  <div className="bg-white rounded-lg shadow-sm p-4">
                    <CreateGroupPost
                      onSubmit={handleCreatePost}
                    />
                  </div>
                )}
                {isMember && isPostingRestricted && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-4 text-sm">
                    You are restricted from posting in this group.
                  </div>
                )}

                {canModerateContent && pendingPosts.length > 0 && (
                  <div className="bg-white rounded-lg shadow-sm p-4 space-y-3">
                    <h3 className="font-semibold text-gray-900">Posts awaiting approval</h3>
                    {pendingPosts.map((post) => (
                      <GroupPostCard
                        key={`pending-${post.id}`}
                        post={post}
                        onLike={() => toggleLike(post.id)}
                        onComment={() => handleComment(post.id)}
                        onShare={() => handleShare(post.id)}
                        onDelete={() => handleDeletePost(post.id)}
                        onEdit={(data) =>
                          updatePost(post.id, {
                            title: data.title,
                            content: data.content,
                            media_urls: data.media_urls ?? [],
                            background_id: data.background_id ?? null,
                          })
                        }
                        onEmojiReaction={handleEmojiReaction}
                        isPostLiked={post.isLiked}
                        viewerRole={viewerRole}
                        onModerate={(action) => moderatePost(post.id, action)}
                        prefetchedReactionGroups={(post.reactions ?? []) as any}
                        prefetchedTotalReactionCount={post.reactions_total_count ?? 0}
                        showCommentsFor={showCommentsFor === post.id}
                        onToggleComments={() => setShowCommentsFor(showCommentsFor === post.id ? null : post.id)}
                      />
                    ))}
                  </div>
                )}

                {/* Posts Feed */}
                {postsLoading ? (
                  <GroupPostsFeedShimmer count={feedShimmerCount} />
                ) : feedPosts.length === 0 ? (
                  <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No posts yet</h3>
                    <p className="text-gray-500">
                      {isMember ? 'Be the first to share something with the group!' : 'Join the group to see posts'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {feedPosts.map((post) => (
                      <GroupPostCard
                        key={post.id}
                        post={post}
                        onLike={() => toggleLike(post.id)}
                        onComment={() => handleComment(post.id)}
                        onShare={() => handleShare(post.id)}
                        onDelete={() => handleDeletePost(post.id)}
                        onEdit={(data) =>
                          updatePost(post.id, {
                            title: data.title,
                            content: data.content,
                            media_urls: data.media_urls ?? [],
                            background_id: data.background_id ?? null,
                          })
                        }
                        onEmojiReaction={handleEmojiReaction}
                        isPostLiked={post.isLiked}
                        viewerRole={viewerRole}
                        onModerate={(action) => moderatePost(post.id, action)}
                        prefetchedReactionGroups={(post.reactions ?? []) as any}
                        prefetchedTotalReactionCount={post.reactions_total_count ?? 0}
                        showCommentsFor={showCommentsFor === post.id}
                        onToggleComments={() => setShowCommentsFor(showCommentsFor === post.id ? null : post.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {visitedTabs.has('about') && (
              <div className={activeTab === 'about' ? 'space-y-4' : 'hidden'}>
              <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Description</h3>
              <p className="text-md text-gray-700 mb-4">{group.description}</p>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  {group.is_public ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  <span>{group.is_public ? 'Public' : 'Private'} Group</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Users className="w-4 h-4" />
                  <span>{group.member_count} members</span>
                </div>
                {group.location && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span>{group.location}</span>
                  </div>
                )}
              </div>

              {isMember && (
                <button
                  onClick={handleLeaveGroup}
                  className="w-full mt-4 px-4 py-2 text-sm text-red-600 bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
                >
                  Leave Group
                </button>
              )}
            </div>
              <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
                {group.goals && group.goals.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <Target className="w-5 h-5" />
                      Goals
                    </h3>
                    <ul className="space-y-2">
                      {group.goals.map((goal, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-primary-600 mt-1">•</span>
                          <span className="text-gray-700">{goal}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {group.tags && group.tags.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Tag className="w-5 h-5" />
                      Tags
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {group.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {group.rules && group.rules.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Shield className="w-5 h-5" />
                      Rules
                    </h3>
                    <ul className="space-y-2">
                      {group.rules.map((rule, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-primary-600 mt-1">•</span>
                          <span className="text-gray-700">{rule}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {group.location && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <MapPin className="w-5 h-5" />
                      Location
                    </h3>
                    <p className="text-gray-700">{group.location}</p>
                  </div>
                )}
              </div>
              </div>
            )}

            {visitedTabs.has('events') && (
              <div className={activeTab === 'events' ? 'space-y-4' : 'hidden'}>
                {/* Create Event Button */}
                {(isMember || isAdmin) && (
                  <div className="bg-white rounded-lg shadow-sm p-4">
                    <div className="flex items-start justify-between w-full">
                    <h4 className=' font-semibold sm:text-lg text-sm'>UpComming Event</h4>
                    <button
                      onClick={() => setShowCreateEventModal(true)}
                      className=" btn-primary flex items-center justify-center sm:gap-2 gap-[4px] text-sm"
                    >
                      <Calendar className="w-5 h-5" />
                      Create Event
                    </button>
                    </div>
                    <div className="flex justify-center py-6">
                      <CiViewTable className='text-9xl text-gray-600'/>
                    </div>
                  </div>
                )}

                {/* Events List */}
                <div className="bg-white rounded-lg shadow-sm sm:p-6 p-4">
                  <GroupEventsList
                    events={events}
                    loading={eventsLoading}
                    onToggleAttendance={toggleAttendance}
                    onDelete={isAdmin ? deleteEvent : undefined}
                    onCreateEvent={() => setShowCreateEventModal(true)}
                  />
                </div>
              </div>
            )}

            {visitedTabs.has('media') && (
              <div className={activeTab === 'media' ? '' : 'hidden'}>
              <div className="bg-white rounded-lg shadow-sm p-6">
                <GroupMediaGallery
                  items={mediaItems}
                  loading={mediaLoading}
                />
              </div>
              </div>
            )}

            {visitedTabs.has('files') && (
              <div className={activeTab === 'files' ? '' : 'hidden'}>
              <div className="bg-white rounded-lg shadow-sm p-6">
                <GroupFilesList
                  files={files}
                  loading={filesLoading}
                />
              </div>
              </div>
            )}

            {visitedTabs.has('members') && (
              <div className={activeTab === 'members' ? 'space-y-4' : 'hidden'}>
                {canManageJoinRequests && (group.is_public === false || pendingJoinCount > 0) && (
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-amber-600" />
                      Pending Join Requests
                      {pendingJoinCount > 0 && (
                        <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-amber-100 text-amber-700 text-xs flex items-center justify-center">
                          {pendingJoinCount}
                        </span>
                      )}
                    </h3>
                    <GroupJoinRequestsList
                      groupId={group.id}
                      enabled={activeTab === 'members'}
                      onChanged={handleJoinRequestsChanged}
                    />
                  </div>
                )}
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <GroupMembersList
                    groupId={group.id}
                    currentUserId={user?.id}
                    viewerRole={viewerRole}
                    refreshToken={membersRefreshKey}
                    onMembersChanged={handleMembersChanged}
                  />
                </div>
              </div>
            )}

            {activeTab === 'requests' && canManageJoinRequests && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-600" />
                  Pending Join Requests
                </h3>
                <GroupJoinRequestsList
                  groupId={group.id}
                  enabled={activeTab === 'requests'}
                  onChanged={handleJoinRequestsChanged}
                />
              </div>
            )}

            {activeTab === 'complaints' && canViewComplaints && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Flag className="w-5 h-5 text-red-600" />
                  User complaints
                </h3>
                <GroupComplaintsList
                  groupId={group.id}
                  enabled={activeTab === 'complaints'}
                  onChanged={() =>
                    setGroup((prev) =>
                      prev
                        ? {
                            ...prev,
                            pending_report_count: Math.max(0, (prev.pending_report_count ?? 1) - 1),
                          }
                        : prev
                    )
                  }
                />
              </div>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-5 space-y-4">
            {/* Stats Card */}
            <div className="bg-white rounded-lg shadow-sm p-4 sticky top-35">
              <h3 className="font-semibold text-gray-900 mb-4">Group Stats</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Members</span>
                  <span className="font-semibold text-gray-900">{group.member_count} / {group.max_members}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Created</span>
                  <span className="font-semibold text-gray-900">
                    {formatDistanceToNow(new Date(group.created_at), { addSuffix: true })}
                  </span>
                </div>
                {group.creator && (
                  <div className='flex items-center justify-between'>
                    <span className="text-gray-600 block mb-2">Created by</span>
                    <div className="flex items-center gap-2">
                      {group.creator.avatar_url ? (
                        <img
                          src={group.creator.avatar_url}
                          alt={group.creator.full_name}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="text-primary-600 font-semibold text-sm">
                            {(group.creator.full_name || group.creator.username || 'U')[0].toUpperCase()}
                          </span>
                        </div>
                      )}
                      <span className="font-medium text-gray-900 text-sm">
                        {group.creator.full_name || group.creator.username}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invite Friends Modal */}
      {group && (
        <InviteFriendsModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          groupId={group.id}
          groupName={group.name}
          onInviteSent={handleInviteSent}
        />
      )}

      {/* Create Event Modal */}
      {group && (
        <CreateGroupEventModal
          isOpen={showCreateEventModal}
          onClose={() => setShowCreateEventModal(false)}
          onSubmit={async (eventData) => {
            await createEvent(eventData)
          }}
        />
      )}

      {dialog}

      {shareModalState.postId && (
        <ShareModal
          isOpen={shareModalState.open}
          onClose={() => setShareModalState({ open: false, postId: null })}
          postUrl={shareUrl}
          postId={shareModalState.postId}
          members={members}
          onSendToMembers={handleSendToMembers}
          onShared={(platform) => {
            if (shareModalState.postId) {
              recordShare(shareModalState.postId, { platform })
            }
          }}
        />
      )}
    </div>
  )
}

export default GroupDetailPage
