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
  GSCH_MUTED,
  GSCH_SELECT,
} from '@/features/gsch/constants/styles'
import {
  GSCH_SUBSCRIPTION_TIERS,
  type GschOrganization,
  type GschPaginated,
  type GschSubscriptionTier,
} from '@/shared/types/gsch'

export default function AdminOrgTiersPanel() {
  const { user, loading: authLoading } = useAuth()
  const [items, setItems] = useState<GschOrganization[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState({ q: '' })
  const [applied, setApplied] = useState(filters)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [tierById, setTierById] = useState<Record<string, GschSubscriptionTier>>({})
  const [notesById, setNotesById] = useState<Record<string, string>>({})

  const activeFilterCount = countActiveFilters(applied)

  const load = useCallback(async () => {
    setLoading(true)
    setForbidden(false)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (applied.q.trim()) params.set('q', applied.q.trim())
      const payload = await apiClient.get<GschPaginated<GschOrganization>>(
        `/api/gsch/admin/organizations?${params.toString()}`
      )
      const list = payload?.data || []
      setItems(list)
      const tiers: Record<string, GschSubscriptionTier> = {}
      const notes: Record<string, string> = {}
      for (const org of list) {
        tiers[org.id] = org.subscription_tier || 'free'
        notes[org.id] = org.subscription_notes || ''
      }
      setTierById(tiers)
      setNotesById(notes)
    } catch (err) {
      setItems([])
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true)
      } else {
        toast.error(err instanceof ApiError ? err.message : 'Failed to load orgs')
      }
    } finally {
      setLoading(false)
    }
  }, [applied])

  useEffect(() => {
    if (authLoading || !user) return
    load()
  }, [authLoading, user?.id, load])

  async function saveTier(id: string) {
    setBusyId(id)
    try {
      await apiClient.patch(`/api/gsch/admin/organizations/${id}/tier`, {
        subscription_tier: tierById[id] || 'free',
        subscription_notes: notesById[id]?.trim() || null,
      })
      toast.success('Subscription tier updated (no payment)')
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
    const empty = { q: '' }
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
        title="Platform admin required"
        description="Organization tiers are assigned by platform admins only. No Stripe or payments."
      />
    )
  }

  return (
    <div className="space-y-4">
      <p className={GSCH_MUTED}>
        Assign free / standard / enterprise tiers manually. No payment processing.
      </p>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <GschFiltersButton
          activeCount={activeFilterCount}
          onClick={() => setFiltersOpen(true)}
        />
      </div>

      <GschFilterDrawer
        open={filtersOpen}
        title="Filter organizations"
        description="Search organizations by name or country."
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
          <label className={GSCH_LABEL} htmlFor="gsch-admin-org-q">
            Search
          </label>
          <input
            id="gsch-admin-org-q"
            className={GSCH_FIELD}
            placeholder="Search name or country"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          />
        </div>
      </GschFilterDrawer>

      {loading ? (
        <div className={`${GSCH_CARD} h-40 animate-pulse`} />
      ) : items.length === 0 ? (
        <EmptyState title="No organizations found" />
      ) : (
        <GschDataTable>
          <GschTableHead>
            <GschTableHeadCell>Organization</GschTableHeadCell>
            <GschTableHeadCell>Status</GschTableHeadCell>
            <GschTableHeadCell>Tier</GschTableHeadCell>
            <GschTableHeadCell>Notes</GschTableHeadCell>
            <GschTableHeadCell align="right">Actions</GschTableHeadCell>
          </GschTableHead>
          <GschTableBody>
            {items.map((org) => (
              <GschTableRow key={org.id}>
                <GschTableCell className="min-w-[160px]">
                  <p className="font-semibold text-content">{org.name}</p>
                  <p className="mt-0.5 text-xs text-content-tertiary">
                    {[org.city, org.country].filter(Boolean).join(', ') || '—'}
                  </p>
                </GschTableCell>
                <GschTableCell>
                  <div className="flex flex-wrap gap-1.5">
                    <StatusBadge status={org.verification_status} />
                    <StatusBadge status={org.subscription_tier || 'free'} />
                  </div>
                </GschTableCell>
                <GschTableCell className="min-w-[140px]">
                  <select
                    className={GSCH_SELECT}
                    value={tierById[org.id] || 'free'}
                    onChange={(e) =>
                      setTierById((m) => ({
                        ...m,
                        [org.id]: e.target.value as GschSubscriptionTier,
                      }))
                    }
                    aria-label={`Tier for ${org.name}`}
                  >
                    {GSCH_SUBSCRIPTION_TIERS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </GschTableCell>
                <GschTableCell className="min-w-[160px]">
                  <input
                    className={GSCH_FIELD}
                    placeholder="Notes (optional)"
                    value={notesById[org.id] || ''}
                    onChange={(e) =>
                      setNotesById((m) => ({ ...m, [org.id]: e.target.value }))
                    }
                    aria-label={`Notes for ${org.name}`}
                  />
                </GschTableCell>
                <GschTableCell align="right">
                  <button
                    type="button"
                    className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/10 disabled:opacity-50"
                    disabled={busyId === org.id}
                    onClick={() => saveTier(org.id)}
                  >
                    {busyId === org.id ? 'Saving…' : 'Save tier'}
                  </button>
                </GschTableCell>
              </GschTableRow>
            ))}
          </GschTableBody>
        </GschDataTable>
      )}
    </div>
  )
}
