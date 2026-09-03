import React from 'react'
import { Check, Clock, X } from '@/shared/icons'
import { formatDistanceToNow } from 'date-fns'
import { useGroupJoinRequests } from '@/shared/hooks/useGroupJoinRequests'

interface GroupJoinRequestsListProps {
  groupId: string
  enabled?: boolean
  onChanged?: () => void
}

const GroupJoinRequestsList: React.FC<GroupJoinRequestsListProps> = ({
  groupId,
  enabled = true,
  onChanged,
}) => {
  const { requests, loading, updatingId, approveRequest, rejectRequest } = useGroupJoinRequests(
    groupId,
    enabled
  )

  const handleApprove = async (requestId: string) => {
    try {
      await approveRequest(requestId)
      onChanged?.()
    } catch {
      // toast handled in hook
    }
  }

  const handleReject = async (requestId: string) => {
    try {
      await rejectRequest(requestId)
      onChanged?.()
    } catch {
      // toast handled in hook
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No pending join requests</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {requests.map((request) => {
        const displayName = request.user?.full_name || request.user?.username || 'Unknown User'
        const requestedAt = request.updated_at || request.joined_at
        const isUpdating = updatingId === request.id

        return (
          <div
            key={request.id}
            className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
          >
            {request.user?.avatar_url ? (
              <img
                src={request.user.avatar_url}
                alt={displayName}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                <span className="text-primary-600 font-semibold">{displayName[0].toUpperCase()}</span>
              </div>
            )}

            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{displayName}</p>
              <p className="text-sm text-gray-500">
                Requested {requestedAt ? formatDistanceToNow(new Date(requestedAt), { addSuffix: true }) : 'recently'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleApprove(request.id)}
                disabled={isUpdating}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                {isUpdating ? 'Saving...' : 'Approve'}
              </button>
              <button
                onClick={() => handleReject(request.id)}
                disabled={isUpdating}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Reject
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default GroupJoinRequestsList
