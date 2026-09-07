'use client'

import React, { useEffect, useState } from 'react'
import { Flag, CheckCircle, X } from '@/shared/icons'
import { apiClient } from '@/lib/api-client'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import { POST_REPORT_REASON_LABELS, type PostReportReason } from '@/lib/reports/types'

interface GroupComplaint {
  id: string
  reason: PostReportReason
  details?: string | null
  status: string
  created_at: string
  reporter?: {
    id: string
    username: string | null
    full_name: string | null
    avatar_url?: string | null
  } | null
  post?: {
    id: string
    title?: string
    content?: string
    is_hidden?: boolean
    is_restricted?: boolean
    author?: {
      full_name?: string | null
      username?: string | null
    } | null
  } | null
}

interface GroupComplaintsListProps {
  groupId: string
  enabled?: boolean
  onChanged?: () => void
}

const GroupComplaintsList: React.FC<GroupComplaintsListProps> = ({
  groupId,
  enabled = true,
  onChanged,
}) => {
  const [complaints, setComplaints] = useState<GroupComplaint[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    const load = async () => {
      try {
        setLoading(true)
        const res = await apiClient.get<{ data: GroupComplaint[] }>(
          `/api/groups/${groupId}/reports`,
          { status: 'pending', page: 0, limit: 50 }
        )
        if (!cancelled) setComplaints(res.data || [])
      } catch (error) {
        console.error('Error fetching complaints:', error)
        if (!cancelled) setComplaints([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [groupId, enabled])

  const updateStatus = async (id: string, status: 'reviewed' | 'dismissed') => {
    setUpdatingId(id)
    try {
      await apiClient.patch(`/api/groups/${groupId}/reports/${id}`, { status })
      setComplaints((prev) => prev.filter((row) => row.id !== id))
      onChanged?.()
      toast.success(status === 'dismissed' ? 'Complaint dismissed' : 'Complaint marked as reviewed')
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to update complaint')
    } finally {
      setUpdatingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (complaints.length === 0) {
    return (
      <div className="text-center py-8">
        <Flag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No pending complaints</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {complaints.map((complaint) => {
        const reporterName =
          complaint.reporter?.full_name || complaint.reporter?.username || 'A member'
        const authorName =
          complaint.post?.author?.full_name || complaint.post?.author?.username || 'Unknown'
        const snippet = (complaint.post?.title || complaint.post?.content || 'Post').slice(0, 120)

        return (
          <div key={complaint.id} className="rounded-lg border border-gray-100 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-gray-900">{snippet}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {reporterName} reported {authorName} for{' '}
                  {POST_REPORT_REASON_LABELS[complaint.reason] || complaint.reason}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {formatDistanceToNow(new Date(complaint.created_at), { addSuffix: true })}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={updatingId === complaint.id}
                  onClick={() => updateStatus(complaint.id, 'reviewed')}
                  className="px-2 py-1 rounded-md text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50 flex items-center gap-1"
                >
                  <CheckCircle className="w-3 h-3" />
                  Review
                </button>
                <button
                  type="button"
                  disabled={updatingId === complaint.id}
                  onClick={() => updateStatus(complaint.id, 'dismissed')}
                  className="px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default GroupComplaintsList
