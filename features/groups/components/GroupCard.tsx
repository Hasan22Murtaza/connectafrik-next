import React, { useState } from 'react'
import { Users, MapPin, Globe, Lock, Calendar, Target, Crown, Shield, UserCheck, MessageCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Group } from '@/shared/types'
import { useAuth } from '@/contexts/AuthContext'
import { useGroups } from '@/shared/hooks/useGroups'
import { useGroupChat } from '@/shared/hooks/useGroupChat'

interface GroupCardProps {
  group: Group
  onJoinGroup?: (groupId: string) => void
  onViewGroup?: (groupId: string) => void
  variant?: 'default' | 'compact'
}

const GroupCard: React.FC<GroupCardProps> = ({
  group,
  onJoinGroup,
  onViewGroup,
  variant = 'default'
}) => {
  const { user } = useAuth()
  const { joinGroup, leaveGroup } = useGroups()
  const { openGroupChat } = useGroupChat()
  const [isJoining, setIsJoining] = useState(false)

  const getCategoryInfo = (category: string) => {
    switch (category) {
      case 'politics':
        return { icon: '🏛️', color: 'bg-red-100 text-red-800' }
      case 'culture':
        return { icon: '🎭', color: 'bg-green-100 text-green-800' }
      case 'education':
        return { icon: '📚', color: 'bg-blue-100 text-blue-800' }
      case 'business':
        return { icon: '💼', color: 'bg-purple-100 text-purple-800' }
      case 'community':
        return { icon: '👥', color: 'bg-orange-100 text-orange-800' }
      case 'activism':
        return { icon: '✊', color: 'bg-yellow-100 text-yellow-800' }
      case 'development':
        return { icon: '🏗️', color: 'bg-gray-100 text-gray-800' }
      default:
        return { icon: '👥', color: 'bg-gray-100 text-gray-800' }
    }
  }

  const getRoleIcon = (role?: string) => {
    switch (role) {
      case 'admin':
        return <Crown className="w-4 h-4 text-yellow-500" />
      case 'moderator':
        return <Shield className="w-4 h-4 text-blue-500" />
      case 'member':
        return <UserCheck className="w-4 h-4 text-green-500" />
      default:
        return null
    }
  }

  const handleJoinGroup = async () => {
    if (!user || !group) return

    setIsJoining(true)
    try {
      if (group.membership) {
        await leaveGroup(group.id)
      } else {
        await joinGroup(group.id)
        onJoinGroup?.(group.id)
      }
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      setIsJoining(false)
    }
  }

  const handleViewGroup = () => {
    onViewGroup?.(group.id)
  }

  const categoryInfo = getCategoryInfo(group.category)
  const isMember = group.membership?.status === 'active'
  const membershipCount = `${group.member_count}${group.member_count >= 1000 ? 'K' : ''}`

  if (variant === 'compact') {
    return (
      <div className="card p-4 hover:shadow-md transition-shadow duration-200">
        <div className="flex items-start space-x-3">
          {/* Group Avatar */}
          <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-african-green rounded-lg flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
            {group.avatar_url ? (
              <img
                src={group.avatar_url}
                alt={group.name}
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <span>{categoryInfo.icon}</span>
            )}
          </div>

          {/* Group Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <h3 className="font-semibold text-gray-900 truncate">{group.name}</h3>
              {group.is_verified && (
                <span className="text-blue-500 text-sm">✓</span>
              )}
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${categoryInfo.color}`}>
                {categoryInfo.icon}
              </span>
            </div>

            <p className="text-sm text-gray-600 line-clamp-2 mb-2">{group.description}</p>

            <div className="flex items-center space-x-4 text-xs text-gray-500">
              <div className="flex items-center space-x-1">
                <Users className="w-3 h-3" />
                <span>{membershipCount}</span>
              </div>
              {group.location && (
                <div className="flex items-center space-x-1">
                  <MapPin className="w-3 h-3" />
                  <span>{group.location}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2">
            {group.membership && getRoleIcon(group.membership.role)}
            <button
              onClick={handleViewGroup}
              className="btn-secondary text-xs px-3 py-1"
            >
              View
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card hover:shadow-lg transition-shadow duration-200">
      {/* Header */}
      <div className="relative">
        {group.banner_url ? (
          <img
            src={group.banner_url}
            alt={group.name}
            className="w-full h-32 object-cover rounded-t-lg"
          />
        ) : (
          <div className="w-full h-32 bg-gradient-to-br from-primary-500 to-african-green rounded-t-lg flex items-center justify-center">
            <span className="text-4xl text-white">{categoryInfo.icon}</span>
          </div>
        )}

        {/* Privacy indicator */}
        <div className="absolute top-3 right-3">
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white ${
            group.is_public ? 'bg-green-500' : 'bg-gray-500'
          }`}>
            {group.is_public ? <Globe className="w-3 h-3 mr-1" /> : <Lock className="w-3 h-3 mr-1" />}
            {group.is_public ? 'Public' : 'Private'}
          </span>
        </div>

        {/* Group avatar */}
        <div className="absolute -bottom-6 left-4 z-10">
          <div className="w-12 h-12 bg-white rounded-lg border-2 border-white shadow-md flex items-center justify-center">
            {group.avatar_url ? (
              <img
                src={group.avatar_url}
                alt={group.name}
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <span className="text-lg leading-none">{categoryInfo.icon}</span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-10 p-4">
        {/* Title and Category */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <h3 className="font-semibold text-gray-900 text-lg">{group.name}</h3>
              {group.is_verified && (
                <span className="text-blue-500">✓</span>
              )}
            </div>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${categoryInfo.color}`}>
              <span className="mr-1">{categoryInfo.icon}</span>
              {group.category.charAt(0).toUpperCase() + group.category.slice(1)}
            </span>
          </div>

          {/* Membership role indicator */}
          {group.membership && (
            <div className="flex items-center space-x-1">
              {getRoleIcon(group.membership.role)}
              <span className="text-xs text-gray-500 capitalize">{group.membership.role}</span>
            </div>
          )}
        </div>

        {/* Description */}
        <p className="text-gray-600 text-sm mb-4 line-clamp-3">{group.description}</p>

        {/* Goals Preview */}
        {group.goals.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center space-x-1 mb-2">
              <Target className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Goals</span>
            </div>
            <div className="space-y-1">
              {group.goals.slice(0, 2).map((goal, index) => (
                <div key={index} className="text-sm text-gray-600 truncate">
                  • {goal}
                </div>
              ))}
              {group.goals.length > 2 && (
                <div className="text-xs text-gray-500">
                  +{group.goals.length - 2} more goals
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center space-x-4 text-sm text-gray-500 mb-4">
          <div className="flex items-center space-x-1">
            <Users className="w-4 h-4" />
            <span>{group.member_count} members</span>
          </div>
          
          {group.location && (
            <div className="flex items-center space-x-1">
              <MapPin className="w-4 h-4" />
              <span>{group.location}</span>
            </div>
          )}

          <div className="flex items-center space-x-1">
            <Calendar className="w-4 h-4" />
            <span>
              Created {formatDistanceToNow(new Date(group.created_at), { addSuffix: true })}
            </span>
          </div>
        </div>

        {/* Creator */}
        {group.creator && (
          <div className="flex items-center space-x-2 mb-4 p-2 bg-gray-50 rounded">
            {group.creator.avatar_url ? (
              <img
                src={group.creator.avatar_url}
                alt={group.creator.full_name}
                className="w-6 h-6 rounded-full object-cover"
              />
            ) : (
              <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center">
                <span className="text-xs text-gray-600">{group.creator.full_name.charAt(0)}</span>
              </div>
            )}
            <div className="text-xs text-gray-600">
              Created by <span className="font-medium">{group.creator.full_name}</span>
            </div>
          </div>
        )}

        {/* Tags */}
        {group.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {group.tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600"
              >
                #{tag}
              </span>
            ))}
            {group.tags.length > 3 && (
              <span className="text-xs text-gray-500">+{group.tags.length - 3}</span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {/* Chat button for members only */}
          {isMember && (
            <button
              onClick={() => openGroupChat(group.id, group.name)}
              className="w-full btn-primary flex items-center justify-center space-x-2"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Open Group Chat</span>
            </button>
          )}

          <div className="flex items-center space-x-3">
            <button
              onClick={handleViewGroup}
              className="flex-1 btn-secondary"
            >
              View Group
            </button>

            {user && (
              <button
                onClick={handleJoinGroup}
                disabled={isJoining || (!group.is_public && !isMember)}
                className={`flex-1 ${
                  isMember
                    ? 'btn-secondary text-red-600 border-red-200 hover:bg-red-50'
                    : 'btn-primary'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isJoining
                  ? 'Loading...'
                  : isMember
                    ? 'Leave Group'
                    : group.is_public
                      ? 'Join Group'
                      : 'Request to Join'
                }
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default GroupCard