import { useCallback, useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { GroupMembership } from '@/shared/types'
import toast from 'react-hot-toast'

export interface GroupJoinRequest extends Omit<GroupMembership, 'user'> {
  user: {
    id: string
    username: string
    full_name: string
    avatar_url?: string | null
    country?: string | null
  }
}

export function useGroupJoinRequests(groupId: string, enabled: boolean = true) {
  const [requests, setRequests] = useState<GroupJoinRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const fetchRequests = useCallback(async (opts?: { silent?: boolean }) => {
    if (!groupId || !enabled) {
      return
    }

    try {
      if (!opts?.silent) setLoading(true)
      const allRequests: GroupJoinRequest[] = []
      let page = 0
      let hasMore = true

      while (hasMore) {
        const res = await apiClient.get<{ data: GroupJoinRequest[]; hasMore?: boolean }>(
          `/api/groups/${groupId}/join-requests`,
          { page, limit: 50 }
        )
        const pageRequests = res.data || []
        allRequests.push(...pageRequests)
        hasMore = Boolean(res.hasMore)
        page += 1
        if (pageRequests.length === 0) break
      }

      setRequests(allRequests)
    } catch (error) {
      console.error('Error fetching join requests:', error)
      if (!opts?.silent) setRequests([])
    } finally {
      setLoading(false)
    }
  }, [groupId, enabled])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const respondToRequest = async (requestId: string, status: 'approved' | 'rejected') => {
    setUpdatingId(requestId)
    try {
      const res = await apiClient.patch<{
        data?: {
          member_count?: number
          status?: string
        }
        member_count?: number
      }>(`/api/groups/${groupId}/join-requests/${requestId}`, { status })
      const memberCount = res?.data?.member_count ?? res?.member_count
      setRequests((prev) => prev.filter((request) => request.id !== requestId))
      toast.success(status === 'approved' ? 'Join request approved' : 'Join request declined')
      return { member_count: memberCount, approved: status === 'approved' }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update join request'
      toast.error(message)
      throw error
    } finally {
      setUpdatingId(null)
    }
  }

  return {
    requests,
    loading,
    updatingId,
    pendingCount: requests.length,
    fetchRequests,
    approveRequest: (requestId: string) => respondToRequest(requestId, 'approved'),
    rejectRequest: (requestId: string) => respondToRequest(requestId, 'rejected'),
  }
}
