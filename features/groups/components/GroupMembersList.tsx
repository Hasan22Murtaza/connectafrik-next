import React, { useState, useEffect } from 'react'
import { Users, UserMinus } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { GroupMembership } from '@/shared/types'
import { formatDistanceToNow } from 'date-fns'
import { getRoleIcon } from '@/shared/utils/groupUtils'
import toast from 'react-hot-toast'

interface GroupMembersListProps {
  groupId: string
  currentUserId?: string
  canManageMembers?: boolean
  onMembersChanged?: () => void
}

interface MemberWithProfile extends GroupMembership {
  user: {
    id: string
    username: string
    full_name: string
    avatar_url?: string
  }
}

const GroupMembersList: React.FC<GroupMembersListProps> = ({
  groupId,
  currentUserId,
  canManageMembers = false,
  onMembersChanged,
}) => {
  const [members, setMembers] = useState<MemberWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)

  useEffect(() => {
    fetchMembers()
  }, [groupId])

  const fetchMembers = async () => {
    try {
      setLoading(true)

      const allMembers: MemberWithProfile[] = []
      let page = 0
      let hasMore = true

      while (hasMore) {
        const res = await apiClient.get<{ data: MemberWithProfile[]; hasMore?: boolean }>(
          `/api/groups/${groupId}/members`,
          { page, limit: 50 }
        )
        const pageMembers = res.data || []
        allMembers.push(...pageMembers)
        hasMore = Boolean(res.hasMore)
        page += 1
        if (pageMembers.length === 0) break
      }

      setMembers(allMembers)
    } catch (error) {
      console.error('Error fetching members:', error)
      setMembers([])
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveMember = async (member: MemberWithProfile) => {
    if (!canManageMembers) return
    if (member.user_id === currentUserId) return
    if (member.role === 'admin') {
      toast.error('Cannot remove admin')
      return
    }
    if (!confirm(`Remove ${member.user?.full_name || member.user?.username || 'this member'} from the group?`)) return

    setRemovingMemberId(member.user_id)
    try {
      await apiClient.delete(`/api/groups/${groupId}/members/${member.user_id}`)
      setMembers((prev) => prev.filter((m) => m.user_id !== member.user_id))
      onMembersChanged?.()
      toast.success('Member removed')
    } catch (error: any) {
      toast.error(error?.message || 'Failed to remove member')
    } finally {
      setRemovingMemberId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (members.length === 0) {
    return (
      <div className="text-center py-8">
        <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No members yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {members.map((member) => (
        <div
          key={member.id}
          className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
        >
          {/* Avatar */}
          {member.user?.avatar_url ? (
            <img
              src={member.user.avatar_url}
              alt={member.user.full_name || member.user.username}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-primary-600 font-semibold">
                {(member.user?.full_name || member.user?.username || 'U')[0].toUpperCase()}
              </span>
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-gray-900 truncate">
                {member.user?.full_name || member.user?.username || 'Unknown User'}
              </p>
              {getRoleIcon(member.role)}
            </div>
            <p className="text-sm text-gray-500">
              Joined {formatDistanceToNow(new Date(member.joined_at), { addSuffix: true })}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {canManageMembers && member.user_id !== currentUserId && member.role !== 'admin' && (
              <button
                onClick={() => handleRemoveMember(member)}
                disabled={removingMemberId === member.user_id}
                className="px-2 py-1 rounded-md text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <UserMinus className="w-3 h-3" />
                {removingMemberId === member.user_id ? 'Removing...' : 'Remove'}
              </button>
            )}
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              member.role === 'admin' 
                ? 'bg-yellow-100 text-yellow-700' 
                : member.role === 'moderator'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-700'
            }`}>
              {member.role}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default GroupMembersList

