'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import EmptyState from '@/features/gsch/components/EmptyState'
import GschFormModal from '@/features/gsch/components/GschFormModal'
import GschFilterDrawer from '@/features/gsch/components/GschFilterDrawer'
import GschFiltersButton, {
  countActiveFilters,
} from '@/features/gsch/components/GschFiltersButton'
import {
  GschDataTable,
  GschRowActions,
  GschTableBody,
  GschTableCell,
  GschTableHead,
  GschTableHeadCell,
  GschTableRow,
} from '@/features/gsch/components/GschDataTable'
import StatusBadge from '@/features/gsch/components/StatusBadge'
import { useConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import {
  GSCH_CARD,
  GSCH_FIELD,
  GSCH_LABEL,
} from '@/features/gsch/constants/styles'
import {
  GSCH_ORG_TYPES,
  type GschOrganization,
  type GschOrgType,
} from '@/shared/types/gsch'

const EMPTY_FORM: {
  name: string
  org_type: GschOrgType
  country: string
  state_province: string
  city: string
  website: string
  official_email: string
  description: string
  areas_of_interest: string
} = {
  name: '',
  org_type: 'municipality',
  country: '',
  state_province: '',
  city: '',
  website: '',
  official_email: '',
  description: '',
  areas_of_interest: '',
}

export default function OrganizationPanel() {
  const { user, loading: authLoading } = useAuth()
  const { confirm, dialog } = useConfirmDialog()
  const [orgs, setOrgs] = useState<GschOrganization[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState({ q: '' })
  const [applied, setApplied] = useState(filters)
  const [form, setForm] = useState(EMPTY_FORM)

  const activeFilterCount = countActiveFilters(applied)

  const filteredOrgs = useMemo(() => {
    const q = applied.q.trim().toLowerCase()
    if (!q) return orgs
    return orgs.filter((org) => org.name.toLowerCase().includes(q))
  }, [orgs, applied.q])

  const load = useCallback(async () => {
    const data = await apiClient.get<GschOrganization[]>('/api/gsch/organizations')
    setOrgs(Array.isArray(data) ? data : [])
  }, [])

  useEffect(() => {
    if (authLoading || !user) return
    ;(async () => {
      setLoading(true)
      try {
        await load()
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Failed to load organizations')
      } finally {
        setLoading(false)
      }
    })()
  }, [authLoading, user?.id, load])

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(org: GschOrganization) {
    setEditingId(org.id)
    setForm({
      name: org.name || '',
      org_type: org.org_type,
      country: org.country || '',
      state_province: org.state_province || '',
      city: org.city || '',
      website: org.website || '',
      official_email: org.official_email || '',
      description: org.description || '',
      areas_of_interest: (org.areas_of_interest || []).join(', '),
    })
    setShowForm(true)
  }

  async function saveOrg() {
    if (!form.name.trim() || !form.country.trim()) {
      toast.error('Name and country are required')
      return
    }
    setBusy(true)
    const payload = {
      ...form,
      areas_of_interest: form.areas_of_interest
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    }
    try {
      if (editingId) {
        await apiClient.patch(`/api/gsch/organizations/${editingId}`, payload)
        toast.success('Organization updated')
      } else {
        await apiClient.post('/api/gsch/organizations', payload)
        toast.success('Organization created as draft — verification required')
      }
      setForm(EMPTY_FORM)
      setEditingId(null)
      setShowForm(false)
      await load()
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : editingId
            ? 'Failed to update organization'
            : 'Failed to create organization'
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(org: GschOrganization) {
    const ok = await confirm({
      title: 'Delete organization?',
      message: `Delete “${org.name}”? Only owners can delete. This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (!ok) return
    setDeletingId(org.id)
    try {
      await apiClient.delete(`/api/gsch/organizations/${org.id}`)
      toast.success('Organization deleted')
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Delete failed')
    } finally {
      setDeletingId(null)
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

  if (authLoading || loading) {
    return <div className={`${GSCH_CARD} h-40 animate-pulse`} />
  }

  if (!user) return <EmptyState title="Sign in required" />

  return (
    <div className="space-y-5">
      {dialog}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" className="btn-primary text-sm" onClick={openCreate}>
          New organization
        </button>
        <GschFiltersButton
          activeCount={activeFilterCount}
          onClick={() => setFiltersOpen(true)}
        />
      </div>

      <GschFilterDrawer
        open={filtersOpen}
        title="Filter organizations"
        description="Search your organizations by name."
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
          <label className={GSCH_LABEL} htmlFor="gsch-org-filter-q">
            Search
          </label>
          <input
            id="gsch-org-filter-q"
            className={GSCH_FIELD}
            placeholder="Organization name…"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          />
        </div>
      </GschFilterDrawer>

      <GschFormModal
        open={showForm}
        title={editingId ? 'Edit organization' : 'Create organization'}
        onClose={() => {
          setShowForm(false)
          setEditingId(null)
        }}
        footer={
          <>
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={busy}
              onClick={() => {
                setShowForm(false)
                setEditingId(null)
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary text-sm"
              disabled={busy}
              onClick={saveOrg}
            >
              {busy
                ? 'Saving…'
                : editingId
                  ? 'Save changes'
                  : 'Create organization'}
            </button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="gsch-org-name" className="mb-1 block text-sm font-medium text-content">
              Name
            </label>
            <input
              id="gsch-org-name"
              className={GSCH_FIELD}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div>
            <label htmlFor="gsch-org-type" className="mb-1 block text-sm font-medium text-content">
              Organization type
            </label>
            <select
              id="gsch-org-type"
              className={GSCH_FIELD}
              value={form.org_type}
              onChange={(e) =>
                setForm((f) => ({ ...f, org_type: e.target.value as GschOrgType }))
              }
            >
              {GSCH_ORG_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="gsch-org-country" className="mb-1 block text-sm font-medium text-content">
              Country
            </label>
            <input
              id="gsch-org-country"
              className={GSCH_FIELD}
              value={form.country}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
              required
            />
          </div>
          <div>
            <label htmlFor="gsch-org-state" className="mb-1 block text-sm font-medium text-content">
              State / province
            </label>
            <input
              id="gsch-org-state"
              className={GSCH_FIELD}
              value={form.state_province}
              onChange={(e) => setForm((f) => ({ ...f, state_province: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="gsch-org-city" className="mb-1 block text-sm font-medium text-content">
              City
            </label>
            <input
              id="gsch-org-city"
              className={GSCH_FIELD}
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="gsch-org-website" className="mb-1 block text-sm font-medium text-content">
              Website
            </label>
            <input
              id="gsch-org-website"
              className={GSCH_FIELD}
              value={form.website}
              onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="gsch-org-email" className="mb-1 block text-sm font-medium text-content">
              Official email
            </label>
            <input
              id="gsch-org-email"
              type="email"
              className={GSCH_FIELD}
              value={form.official_email}
              onChange={(e) => setForm((f) => ({ ...f, official_email: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="gsch-org-desc" className="mb-1 block text-sm font-medium text-content">
              Description
            </label>
            <textarea
              id="gsch-org-desc"
              className={`${GSCH_FIELD} min-h-[88px]`}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="gsch-org-interests" className="mb-1 block text-sm font-medium text-content">
              Areas of interest (comma-separated)
            </label>
            <input
              id="gsch-org-interests"
              className={GSCH_FIELD}
              value={form.areas_of_interest}
              onChange={(e) => setForm((f) => ({ ...f, areas_of_interest: e.target.value }))}
              placeholder="education, tourism, climate"
            />
          </div>
        </div>
      </GschFormModal>

      {orgs.length === 0 ? (
        <EmptyState
          title="No organizations yet"
          description="Create an organization to begin verification and city profile management."
          action={
            <button type="button" className="btn-primary" onClick={openCreate}>
              Create organization
            </button>
          }
        />
      ) : filteredOrgs.length === 0 ? (
        <EmptyState
          title="No matching organizations"
          description="Try a different search term."
        />
      ) : (
        <GschDataTable>
          <GschTableHead>
            <GschTableHeadCell>Organization</GschTableHeadCell>
            <GschTableHeadCell>Type</GschTableHeadCell>
            <GschTableHeadCell>Status</GschTableHeadCell>
            <GschTableHeadCell>Role</GschTableHeadCell>
            <GschTableHeadCell align="right">Actions</GschTableHeadCell>
          </GschTableHead>
          <GschTableBody>
            {filteredOrgs.map((org) => (
              <GschTableRow key={org.id}>
                <GschTableCell className="min-w-[160px]">
                  <p className="font-semibold text-content">{org.name}</p>
                  <p className="text-xs text-content-tertiary">
                    {[org.city, org.country].filter(Boolean).join(', ')}
                  </p>
                </GschTableCell>
                <GschTableCell className="capitalize">
                  {org.org_type.replace(/_/g, ' ')}
                </GschTableCell>
                <GschTableCell>
                  <div className="flex flex-wrap gap-1.5">
                    <StatusBadge status={org.verification_status} />
                    <StatusBadge status={org.subscription_tier || 'free'} />
                  </div>
                </GschTableCell>
                <GschTableCell className="capitalize">
                  {org.my_role || '—'}
                </GschTableCell>
                <GschTableCell align="right">
                  <GschRowActions
                    onEdit={() => openEdit(org)}
                    onDelete={() => handleDelete(org)}
                    deleting={deletingId === org.id}
                  />
                </GschTableCell>
              </GschTableRow>
            ))}
          </GschTableBody>
        </GschDataTable>
      )}

      <p className="text-sm text-content-secondary">
        Ready to verify?{' '}
        <Link href="/global-hub/verification" className="font-medium text-primary">
          Submit verification
        </Link>
      </p>
    </div>
  )
}
