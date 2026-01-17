'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Users,
  MessageCircle,
  Settings,
  Shield,
  Globe,
  Lock,
  MapPin,
  Calendar,
  Target,
  Tag,
  Plus,
  LogOut,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useGroups } from '@/shared/hooks/useGroups'
import { useGroupChat } from '@/shared/hooks/useGroupChat'
import { Group } from '@/shared/types'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import GroupMembersList from '@/features/groups/components/GroupMembersList'
import { getCategoryInfoLarge, getRoleIcon } from '@/shared/utils/groupUtils'

const GroupDetailPage: React.FC = () => {
  const params = useParams()
  const router = useRouter()
  const groupId = params?.id as string
  const { user } = useAuth()
  const { fetchGroupById, joinGroup, leaveGroup } = useGroups()
  const { openGroupChat } = useGroupChat()
  
  const [group, setGroup] = useState<Group | null>(null)
  const [loading, setLoading] = useState(true)
  const [isJoining, setIsJoining] = useState(false)
  const [activeTab, setActiveTab] = useState<'about' | 'members'>('about')

  useEffect(() => {
    if (groupId) {
      fetchGroup()
    }
  }, [groupId, user])

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
      // Refresh group data to get updated member count
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
      // Refresh group data to get updated member count
      await fetchGroup()
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      setIsJoining(false)
    }
  }



  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
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
    <div className="min-h-screen bg-gray-50">

      {/* Banner */}
      <div className="relative">
        {group.banner_url ? (
          <div className="w-full h-64 bg-gray-200">
            <img
              src={group.banner_url}
              alt={group.name}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className={`w-full h-64 flex items-center justify-center ${categoryInfo.color}`}>
            <span className="text-6xl">{categoryInfo.icon}</span>
          </div>
        )}

        {/* Avatar */}
        <div className="absolute -bottom-12 left-8">
          <div className="w-24 h-24 rounded-full bg-white border-4 border-white shadow-lg flex items-center justify-center">
            {group.avatar_url ? (
              <img
                src={group.avatar_url}
                alt={group.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="text-4xl">{categoryInfo.icon}</span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 pt-20 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Group Info Card */}
            <div className="card">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-3xl font-bold text-gray-900">{group.name}</h1>
                    {group.is_verified && (
                      <span className="text-blue-500 text-xl">✓</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${categoryInfo.color}`}>
                      {categoryInfo.icon}
                      {group.category}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium text-white ${
                      group.is_public ? 'bg-green-500' : 'bg-gray-600'
                    }`}>
                      {group.is_public ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                      {group.is_public ? 'Public' : 'Private'}
                    </span>
                    {isMember && group.membership && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                        {getRoleIcon(group.membership.role)}
                        {group.membership.role}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-gray-700 mb-6">{group.description}</p>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                {isMember ? (
                  <>
                    <button
                      onClick={() => openGroupChat(group.id, group.name)}
                      className="btn-primary flex items-center gap-2"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Open Group Chat
                    </button>
                    {/* {isAdmin && (
                      <button
                        onClick={() => router.push(`/groups/${group.id}/settings`)}
                        className="btn-secondary flex items-center gap-2"
                      >
                        <Settings className="w-4 h-4" />
                        Settings
                      </button>
                    )} */}
                    <button
                      onClick={handleLeaveGroup}
                      disabled={isJoining}
                      className="btn-secondary flex items-center gap-2 text-red-600 hover:text-red-700"
                    >
                      <LogOut className="w-4 h-4" />
                      Leave Group
                    </button>
                  </>
                ) : user ? (
                  <button
                    onClick={handleJoinGroup}
                    disabled={isJoining}
                    className="btn-primary flex items-center gap-2"
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
                    onClick={() => router.push('/auth/login')}
                    className="btn-primary"
                  >
                    Login to Join
                  </button>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="card">
              <div className="border-b border-gray-200 mb-6">
                <div className="flex gap-4">
                  <button
                    onClick={() => setActiveTab('about')}
                    className={`pb-3 px-1 font-medium transition-colors ${
                      activeTab === 'about'
                        ? 'text-primary-600 border-b-2 border-primary-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    About
                  </button>
                  <button
                    onClick={() => setActiveTab('members')}
                    className={`pb-3 px-1 font-medium transition-colors ${
                      activeTab === 'members'
                        ? 'text-primary-600 border-b-2 border-primary-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Members ({group.member_count})
                  </button>
                </div>
              </div>

              {activeTab === 'about' && (
                <div className="space-y-6">
                  {/* Goals */}
                  {group.goals && group.goals.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
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

                  {/* Tags */}
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

                  {/* Rules */}
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

                  {/* Location */}
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
              )}

              {activeTab === 'members' && (
                <GroupMembersList groupId={group.id} currentUserId={user?.id} />
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6 ">
            {/* Stats Card */}
            <div className="card sticky top-20">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Group Stats</h3>
              <div className="space-y-4">
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
                  <div className='flex justify-between gap-2'>
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
                      <span className="font-medium text-gray-900">
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
    </div>
  )
}

export default GroupDetailPage

