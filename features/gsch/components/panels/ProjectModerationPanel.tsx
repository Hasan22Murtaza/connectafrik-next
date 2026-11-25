'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { GSCH_CARD, GSCH_LABEL, GSCH_SELECT } from '@/features/gsch/constants/styles'
import type { GschPaginated, GschProject } from '@/shared/types/gsch'

export default function ProjectModerationPanel() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [items, setItems] = useState<GschProject[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState({ status: 'pending_review' })
  const [applied, setApplied] = useState(filters)
  const [busyId, setBusyId] = useState<string | null>(null)

  const activeFilterCount = countActiveFilters(applied)

  const load = useCallback(async () => {
    setLoading(true)
    setForbidden(false)
    try {
      const params = new URLSearchParams()
      params.set('limit', '50')
      if (applied.status) params.set('status', applied.status)
      const payload = await apiClient.get<GschPaginated<GschProject>>(
        `/api/gsch/admin/projects?${params.toString()}`
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

  async function review(id: string, verification_status: 'verified' | 'rejected') {
    setBusyId(id)
    try {
      await apiClient.patch(`/api/gsch/admin/projects/${id}`, {
        verification_status,
      })
      toast.success(`Marked as ${verification_status}`)
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Update failed')
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
        description="Only platform admins can moderate investment projects."
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
        title="Filter projects"
        description="Narrow the moderation queue by verification status."
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
          <label className={GSCH_LABEL} htmlFor="gsch-project-status">
            Status
          </label>
          <select
            id="gsch-project-status"
            className={`${GSCH_SELECT} w-full`}
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="pending_review">Pending review</option>
            <option value="unverified">Unverified</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
            <option value="">All in default queue</option>
          </select>
        </div>
      </GschFilterDrawer>

      {loading ? (
        <div className={`${GSCH_CARD} h-40 animate-pulse`} />
      ) : items.length === 0 ? (
        <EmptyState title="No projects in this queue" />
      ) : (
        <GschDataTable>
          <GschTableHead>
            <GschTableHeadCell>Project</GschTableHeadCell>
            <GschTableHeadCell>Category</GschTableHeadCell>
            <GschTableHeadCell>Status</GschTableHeadCell>
            <GschTableHeadCell>Stage</GschTableHeadCell>
            <GschTableHeadCell align="right">Actions</GschTableHeadCell>
          </GschTableHead>
          <GschTableBody>
            {items.map((project) => (
              <GschTableRow
                key={project.id}
                onClick={() =>
                  router.push(`/global-hub/investment/${project.id}`)
                }
              >
                <GschTableCell className="min-w-[180px]">
                  <p className="font-semibold text-content">{project.title}</p>
                  <p className="mt-0.5 text-xs text-content-tertiary">
                    {[project.organization?.name, project.country]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </p>
                </GschTableCell>
                <GschTableCell className="capitalize">
                  {project.category.replace(/_/g, ' ')}
                </GschTableCell>
                <GschTableCell>
                  <StatusBadge status={project.verification_status} />
                </GschTableCell>
                <GschTableCell>
                  <StatusBadge status={project.project_stage} />
                </GschTableCell>
                <GschTableCell align="right">
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <button
                      type="button"
                      className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/10 disabled:opacity-50"
                      disabled={busyId === project.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        review(project.id, 'verified')
                      }}
                    >
                      Verify
                    </button>
                    <button
                      type="button"
                      className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/30"
                      disabled={busyId === project.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        review(project.id, 'rejected')
                      }}
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
