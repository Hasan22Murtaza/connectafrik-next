'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
} from 'lucide-react'
import { IoMdShareAlt } from "react-icons/io";
import { useAuth } from '@/contexts/AuthContext'
import { useGroups } from '@/shared/hooks/useGroups'
import { useGroupChat } from '@/shared/hooks/useGroupChat'
import { useGroupPosts } from '@/shared/hooks/useGroupPosts'
import { Group } from '@/shared/types'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import GroupMembersList from '@/features/groups/components/GroupMembersList'
import InviteFriendsModal from '@/features/groups/components/InviteFriendsModal'
import CreateGroupPost from '@/features/groups/components/CreateGroupPost'
import GroupPostCard from '@/features/groups/components/GroupPostCard'
import CreateGroupEventModal from '@/features/groups/components/CreateGroupEventModal'
import GroupEventsList from '@/features/groups/components/GroupEventsList'
import GroupMediaGallery from '@/features/groups/components/GroupMediaGallery'
import GroupFilesList from '@/features/groups/components/GroupFilesList'
import { useGroupEvents } from '@/shared/hooks/useGroupEvents'
import { getCategoryInfoLarge } from '@/shared/utils/groupUtils'
import { CiViewTable } from "react-icons/ci";
import {
  useFeedShimmerCount,
  GroupPostsFeedShimmer,
  GroupDetailPageShimmer,
} from '@/shared/components/ui/ShimmerLoaders'

const GroupDetailPage: React.FC = () => {
  const params = useParams()
  const router = useRouter()
  const groupId = params?.id as string
  const { user, loading: authLoading } = useAuth()
  const { fetchGroupById, joinGroup, leaveGroup } = useGroups()
  const { openGroupChat } = useGroupChat()
  const { 
    posts: groupPosts, 
    loading: postsLoading, 
    createGroupPost, 
    toggleLike, 
    deletePost, 
    updatePost, 
    recordView 
  } = useGroupPosts(groupId || '')
  
  const [group, setGroup] = useState<Group | null>(null)
  const [loading, setLoading] = useState(true)
  const [isJoining, setIsJoining] = useState(false)
  const [activeTab, setActiveTab] = useState<'posts' | 'events' | 'media' | 'files' | 'about' | 'members'>('posts')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showCreateEventModal, setShowCreateEventModal] = useState(false)
  const [showCommentsFor, setShowCommentsFor] = useState<string | null>(null)
  const [isSticky, setIsSticky] = useState(false)
  const feedShimmerCount = useFeedShimmerCount()

  const {
    events,
    loading: eventsLoading,
    createEvent,
    toggleAttendance,
    deleteEvent
  } = useGroupEvents(groupId || '')

  useEffect(() => {
    // Wait for auth to finish loading before fetching group
    if (groupId && !authLoading) {
      fetchGroup()
    }
  }, [groupId, user, authLoading])

  useEffect(() => {
    const handleScroll = () => {
      setIsSticky(window.scrollY > 200)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const fetchGroup = async () => {
    try {
      setLoading(true)
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
      router.push('/groups')
    } finally {
      setLoading(false)
    }
  }

  const handleJoinGroup = async () => {
    if (!user || !group) return

    setIsJoining(true)
    try {
      await joinGroup(group.id)
      await fetchGroup()
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      setIsJoining(false)
    }
  }

  const handleLeaveGroup = async () => {
    if (!user || !group) return

    if (!confirm('Are you sure you want to leave this group?')) return

    setIsJoining(true)
    try {
      await leaveGroup(group.id)
      await fetchGroup()
    } catch (error) {
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
  }) => {
    if (!user || !group) return

    try {
      await createGroupPost(postData)
    } catch (error) {
      // Error handling is done in the hook
    }
  }

  const handleToggleLike = (postId: string) => {
    toggleLike(postId)
  }

  const handleComment = (postId: string) => {
    setShowCommentsFor(postId)
  }

  const handleShare = (postId: string) => {
    const shareUrl = `${window.location.origin}/posts/${postId}`
    if (navigator.share) {
      navigator.share({ url: shareUrl })
    } else {
      navigator.clipboard.writeText(shareUrl)
      toast.success('Link copied to clipboard!')
    }
  }

  const handleShareGroup = (groupid: string) => {
    const shareUrl = `${window.location.origin}/groups/${groupid}`
    if (navigator.share) {
      navigator.share({ url: shareUrl })
    } else {
      navigator.clipboard.writeText(shareUrl)
      toast.success('Link copied to clipboard!')
    }
  }

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
  const isAdmin = group.membership?.role === 'admin'
  const categoryInfo = getCategoryInfoLarge(group.category)

  return (
    <div className="min-h-screen bg-gray-100  max-w-full 2xl:max-w-screen-2xl mx-auto">
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
              ) : user ? (
                <button
                  onClick={handleJoinGroup}
                  disabled={isJoining}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
                >
                  {isJoining ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Joining...
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
              onClick={() => setActiveTab('posts')}
              className={`px-4 py-3 font-medium transition-colors border-b-2 shrink-0  ${
                activeTab === 'posts'
                  ? 'text-primary-600 border-primary-600'
                  : 'text-gray-600 border-transparent hover:text-gray-600 hover:bg-gray-50'
              }`}
            >
              Posts
            </button>
           
            <button
              onClick={() => setActiveTab('about')}
              className={`px-4 py-3 font-medium transition-colors border-b-2 shrink-0  ${
                activeTab === 'about'
                  ? 'text-primary-600 border-primary-600'
                  : 'text-gray-600 border-transparent hover:text-gray-600 hover:bg-gray-50'
              }`}
            >
              About
            </button>

            <button
              onClick={() => setActiveTab('members')}
              className={`px-4 py-3 font-medium transition-colors border-b-2 shrink-0  ${
                activeTab === 'members'
                  ? 'text-primary-600 border-primary-600'
                  : 'text-gray-600 border-transparent hover:text-gray-600 hover:bg-gray-50'
              }`}
            >
              Members ({group.member_count})
            </button>

            <button
              onClick={() => setActiveTab('events')}
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
              onClick={() => setActiveTab('media')}
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
              onClick={() => setActiveTab('files')}
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
      <div className="px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
       
          {/* Center Content */}
          <div className="lg:col-span-7 space-y-4">
            {activeTab === 'posts' && (
              <>
                {/* Create Post */}
                {isMember && (
                  <div className="bg-white rounded-lg shadow-sm p-4">
                    <CreateGroupPost
                      onSubmit={handleCreatePost}
                    />
                  </div>
                )}

                {/* Posts Feed */}
                {postsLoading ? (
                  <GroupPostsFeedShimmer count={feedShimmerCount} />
                ) : groupPosts.length === 0 ? (
                  <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No posts yet</h3>
                    <p className="text-gray-500">
                      {isMember ? 'Be the first to share something with the group!' : 'Join the group to see posts'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {groupPosts.map((post) => (
                      <GroupPostCard
                        key={post.id}
                        post={post}
                        onLike={() => toggleLike(post.id)}
                        onComment={() => handleComment(post.id)}
                        onShare={() => handleShare(post.id)}
                        onDelete={() => deletePost(post.id)}
                        onEdit={(title, content) => updatePost(post.id, { title, content })}
                        onView={() => recordView(post.id)}
                        isPostLiked={post.isLiked}
                        showCommentsFor={showCommentsFor === post.id}
                        onToggleComments={() => setShowCommentsFor(showCommentsFor === post.id ? null : post.id)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === 'about' && (
              <>
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
              </>
            )}

            {activeTab === 'events' && (
              <div className="space-y-4">
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

            {activeTab === 'media' && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <GroupMediaGallery
                  posts={groupPosts}
                  loading={postsLoading}
                />
              </div>
            )}

            {activeTab === 'files' && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <GroupFilesList
                  posts={groupPosts}
                  loading={postsLoading}
                />
              </div>
            )}

            {activeTab === 'members' && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <GroupMembersList groupId={group.id} currentUserId={user?.id} />
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
          onInviteSent={() => {
            fetchGroup()
          }}
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
    </div>
  )
}

export default GroupDetailPage
