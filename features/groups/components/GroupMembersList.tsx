import React, { useState, useEffect } from 'react'
import { Users, MapPin } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { GroupMembership } from '@/shared/types'
import { formatDistanceToNow } from 'date-fns'
import { getRoleIcon } from '@/shared/utils/groupUtils'

interface GroupMembersListProps {
  groupId: string
  currentUserId?: string
}

interface MemberWithProfile extends GroupMembership {
  user: {
    id: string
    username: string
    full_name: string
    avatar_url?: string
  }
}

const GroupMembersList: React.FC<GroupMembersListProps> = ({ groupId, currentUserId }) => {
  const [members, setMembers] = useState<MemberWithProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMembers()
  }, [groupId])

  const fetchMembers = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('group_memberships')
        .select(`
          *,
          user:profiles!user_id(id, username, full_name, avatar_url)
        `)
        .eq('group_id', groupId)
        .eq('status', 'active')
        .order('role', { ascending: false })
        .order('joined_at', { ascending: true })
    console.log(data)
      if (error) throw error

      setMembers(data || [])
    } catch (error) {
      console.error('Error fetching members:', error)
    } finally {
      setLoading(false)
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

          {/* Role Badge */}
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
      ))}
    </div>
  )
}

export default GroupMembersList

