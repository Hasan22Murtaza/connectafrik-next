'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import EmptyState from '@/features/gsch/components/EmptyState'
import StatusBadge from '@/features/gsch/components/StatusBadge'
import { GSCH_CARD, GSCH_FIELD, GSCH_SELECT } from '@/features/gsch/constants/styles'
import {
  GSCH_VERIFICATION_BADGES,
  type GschPaginated,
  type GschVerification,
  type GschVerificationBadge,
  type GschVerificationStatus,
} from '@/shared/types/gsch'

export default function AdminVerificationsPanel() {
  const { user, loading: authLoading } = useAuth()
  const [items, setItems] = useState<GschVerification[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [badgeById, setBadgeById] = useState<Record<string, GschVerificationBadge>>({})
  const [notesById, setNotesById] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setForbidden(false)
    try {
      const payload = await apiClient.get<GschPaginated<GschVerification>>(
        '/api/gsch/admin/verifications',
        { status: statusFilter || undefined, limit: 50 }
      )
      setItems(payload?.data || [])
    } catch (err) {
      setItems([])
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true)
      } else {
        toast.error(err instanceof ApiError ? err.message : 'Failed to load queue')
      }
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    if (authLoading || !user) return
    load()
  }, [authLoading, user?.id, load])

  async function review(
    id: string,
    status: GschVerificationStatus
  ) {
    if (status === 'verified' && !badgeById[id]) {
      toast.error('Select a verification badge before approving')
      return
    }
    setBusyId(id)
    try {
      await apiClient.patch(`/api/gsch/admin/verifications/${id}`, {
        status,
        verification_badge: badgeById[id] || null,
        admin_notes: notesById[id]?.trim() || null,
        rejection_reason: status === 'rejected' ? notesById[id]?.trim() || null : null,
        additional_info_notes:
          status === 'additional_info_required' ? notesById[id]?.trim() || null : null,
      })
      toast.success(`Marked as ${status.replace(/_/g, ' ')}`)
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update verification')
    } finally {
      setBusyId(null)
    }
  }

  if (authLoading || loading) {
    return <div className={`${GSCH_CARD} h-40 animate-pulse`} />
  }

  if (!user) return <EmptyState title="Sign in required" />

  if (forbidden) {
    return (
      <EmptyState
        title="Admin access required"
        description="Only platform admins can review Global Hub verification requests."
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="gsch-admin-status" className="text-sm font-medium text-content">
          Status
        </label>
        <select
          id="gsch-admin-status"
          className={GSCH_SELECT}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Queue (pending)</option>
          <option value="submitted">Submitted</option>
          <option value="under_review">Under review</option>
          <option value="additional_info_required">Additional info</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {items.length === 0 ? (
        <EmptyState title="No verification requests in this queue" />
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className={`${GSCH_CARD} space-y-3`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-content">
                    {item.organization?.name || 'Organization'}
                  </p>
                  <p className="mt-0.5 text-xs capitalize text-content-tertiary">
                    {(item.organization?.org_type || '').replace(/_/g, ' ')} ·{' '}
                    {item.organization?.country}
                  </p>
                  {item.notes ? (
                    <p className="mt-2 text-sm text-content-secondary">{item.notes}</p>
                  ) : null}
                  {(item.document_urls || []).length > 0 ? (
                    <ul className="mt-2 space-y-1 text-sm">
                      {item.document_urls.map((url) => (
                        <li key={url}>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <StatusBadge status={item.status} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor={`badge-${item.id}`}
                    className="mb-1 block text-sm font-medium text-content"
                  >
                    Verification badge
                  </label>
                  <select
                    id={`badge-${item.id}`}
                    className={GSCH_FIELD}
                    value={badgeById[item.id] || ''}
                    onChange={(e) =>
                      setBadgeById((m) => ({
                        ...m,
                        [item.id]: e.target.value as GschVerificationBadge,
                      }))
                    }
                  >
                    <option value="">Select badge…</option>
                    {GSCH_VERIFICATION_BADGES.map((b) => (
                      <option key={b.value} value={b.value}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor={`notes-${item.id}`}
                    className="mb-1 block text-sm font-medium text-content"
                  >
                    Admin notes
                  </label>
                  <input
                    id={`notes-${item.id}`}
                    className={GSCH_FIELD}
                    value={notesById[item.id] || ''}
                    onChange={(e) =>
                      setNotesById((m) => ({ ...m, [item.id]: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  disabled={busyId === item.id}
                  onClick={() => review(item.id, 'under_review')}
                >
                  Mark under review
                </button>
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  disabled={busyId === item.id}
                  onClick={() => review(item.id, 'additional_info_required')}
                >
                  Request info
                </button>
                <button
                  type="button"
                  className="btn-primary text-sm"
                  disabled={busyId === item.id}
                  onClick={() => review(item.id, 'verified')}
                >
                  Verify
                </button>
                <button
                  type="button"
                  className="btn-secondary text-sm text-red-600"
                  disabled={busyId === item.id}
                  onClick={() => review(item.id, 'rejected')}
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
