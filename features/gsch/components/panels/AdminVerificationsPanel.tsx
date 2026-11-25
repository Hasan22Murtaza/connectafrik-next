'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import EmptyState from '@/features/gsch/components/EmptyState'
import GschFilterDrawer from '@/features/gsch/components/GschFilterDrawer'
import GschFiltersButton, {
  countActiveFilters,
} from '@/features/gsch/components/GschFiltersButton'
import {
  GschDataTable,
  GschTableBody,
  GschTableCell,
  GschTableHead,
  GschTableHeadCell,
  GschTableRow,
} from '@/features/gsch/components/GschDataTable'
import StatusBadge from '@/features/gsch/components/StatusBadge'
import {
  GSCH_CARD,
  GSCH_FIELD,
  GSCH_LABEL,
  GSCH_SELECT,
} from '@/features/gsch/constants/styles'
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
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState({ status: '' })
  const [applied, setApplied] = useState(filters)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [badgeById, setBadgeById] = useState<Record<string, GschVerificationBadge>>({})
  const [notesById, setNotesById] = useState<Record<string, string>>({})

  const activeFilterCount = countActiveFilters(applied)

  const load = useCallback(async () => {
    setLoading(true)
    setForbidden(false)
    try {
      const payload = await apiClient.get<GschPaginated<GschVerification>>(
        '/api/gsch/admin/verifications',
        { status: applied.status || undefined, limit: 50 }
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
  }, [applied])

  useEffect(() => {
    if (authLoading || !user) return
    load()
  }, [authLoading, user?.id, load])

  async function review(id: string, status: GschVerificationStatus) {
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

  function applyFilters() {
    setApplied(filters)
    setFiltersOpen(false)
  }

  function resetFilters() {
    const empty = { status: '' }
    setFilters(empty)
    setApplied(empty)
    setFiltersOpen(false)
  }

  if (authLoading) {
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
      <div className="flex flex-wrap items-center justify-end gap-3">
        <GschFiltersButton
          activeCount={activeFilterCount}
          onClick={() => setFiltersOpen(true)}
        />
      </div>

      <GschFilterDrawer
        open={filtersOpen}
        title="Filter verifications"
        description="Narrow the admin verification queue by status."
        onClose={() => setFiltersOpen(false)}
        footer={
          <>
            <button type="button" className="btn-secondary text-sm" onClick={resetFilters}>
              Reset
            </button>
            <button type="button" className="btn-primary text-sm" onClick={applyFilters}>
              Apply filters
            </button>
          </>
        }
      >
        <div>
          <label className={GSCH_LABEL} htmlFor="gsch-admin-status">
            Status
          </label>
          <select
            id="gsch-admin-status"
            className={`${GSCH_SELECT} w-full`}
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="">Queue (pending)</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under review</option>
            <option value="additional_info_required">Additional info</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </GschFilterDrawer>

      {loading ? (
        <div className={`${GSCH_CARD} h-40 animate-pulse`} />
      ) : items.length === 0 ? (
        <EmptyState title="No verification requests in this queue" />
      ) : (
        <GschDataTable>
          <GschTableHead>
            <GschTableHeadCell>Organization</GschTableHeadCell>
            <GschTableHeadCell>Details</GschTableHeadCell>
            <GschTableHeadCell>Status</GschTableHeadCell>
            <GschTableHeadCell>Review</GschTableHeadCell>
            <GschTableHeadCell align="right">Actions</GschTableHeadCell>
          </GschTableHead>
          <GschTableBody>
            {items.map((item) => (
              <GschTableRow key={item.id}>
                <GschTableCell className="min-w-[160px]">
                  <p className="font-semibold text-content">
                    {item.organization?.name || 'Organization'}
                  </p>
                  <p className="mt-0.5 text-xs capitalize text-content-tertiary">
                    {(item.organization?.org_type || '').replace(/_/g, ' ')}
                    {item.organization?.country
                      ? ` · ${item.organization.country}`
                      : ''}
                  </p>
                </GschTableCell>
                <GschTableCell className="max-w-[260px]">
                  {item.notes ? (
                    <p className="mb-1 line-clamp-2 text-sm text-content-secondary">
                      {item.notes}
                    </p>
                  ) : null}
                  {(item.document_urls || []).length > 0 ? (
                    <ul className="space-y-1 text-xs">
                      {item.document_urls.map((url) => (
                        <li key={url}>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            Document
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-xs text-content-tertiary">No documents</span>
                  )}
                </GschTableCell>
                <GschTableCell>
                  <StatusBadge status={item.status} />
                </GschTableCell>
                <GschTableCell className="min-w-[200px]">
                  <div className="space-y-2">
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
                      aria-label="Verification badge"
                    >
                      <option value="">Select badge…</option>
                      {GSCH_VERIFICATION_BADGES.map((b) => (
                        <option key={b.value} value={b.value}>
                          {b.label}
                        </option>
                      ))}
                    </select>
                    <input
                      id={`notes-${item.id}`}
                      className={GSCH_FIELD}
                      placeholder="Admin notes"
                      value={notesById[item.id] || ''}
                      onChange={(e) =>
                        setNotesById((m) => ({ ...m, [item.id]: e.target.value }))
                      }
                      aria-label="Admin notes"
                    />
                  </div>
                </GschTableCell>
                <GschTableCell align="right">
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <button
                      type="button"
                      className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-content-secondary transition hover:bg-surface-hover hover:text-content disabled:opacity-50"
                      disabled={busyId === item.id}
                      onClick={() => review(item.id, 'under_review')}
                    >
                      Under review
                    </button>
                    <button
                      type="button"
                      className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-content-secondary transition hover:bg-surface-hover hover:text-content disabled:opacity-50"
                      disabled={busyId === item.id}
                      onClick={() => review(item.id, 'additional_info_required')}
                    >
                      Request info
                    </button>
                    <button
                      type="button"
                      className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/10 disabled:opacity-50"
                      disabled={busyId === item.id}
                      onClick={() => review(item.id, 'verified')}
                    >
                      Verify
                    </button>
                    <button
                      type="button"
                      className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/30"
                      disabled={busyId === item.id}
                      onClick={() => review(item.id, 'rejected')}
                    >
                      Reject
                    </button>
                  </div>
                </GschTableCell>
              </GschTableRow>
            ))}
          </GschTableBody>
        </GschDataTable>
      )}
    </div>
  )
}
