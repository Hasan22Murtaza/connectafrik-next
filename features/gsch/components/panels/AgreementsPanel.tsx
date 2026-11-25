'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  GSCH_MUTED,
  GSCH_SECTION_TITLE,
  GSCH_SELECT,
} from '@/features/gsch/constants/styles'
import {
  GSCH_AGREEMENT_DISCLAIMER,
  GSCH_AGREEMENT_STATUSES,
  GSCH_AGREEMENT_TEMPLATE_TYPES,
  type GschAgreement,
  type GschAgreementTemplateType,
  type GschCity,
  type GschOrganization,
  type GschPaginated,
} from '@/shared/types/gsch'

const EMPTY_FORM = {
  organization_a_id: '',
  organization_b_id: '',
  city_a_id: '',
  city_b_id: '',
  title: '',
  template_type: 'sister_city' as GschAgreementTemplateType,
  objectives: '',
  duration_label: '',
  responsibilities_a: '',
  responsibilities_b: '',
}

export default function AgreementsPanel() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { confirm, dialog } = useConfirmDialog()
  const [items, setItems] = useState<GschAgreement[]>([])
  const [orgs, setOrgs] = useState<GschOrganization[]>([])
  const [cities, setCities] = useState<GschCity[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState({ status: '' })
  const [applied, setApplied] = useState(filters)
  const [form, setForm] = useState(EMPTY_FORM)

  const activeFilterCount = countActiveFilters(applied)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '40' })
      if (applied.status) params.set('status', applied.status)
      const data = await apiClient.get<GschPaginated<GschAgreement>>(
        `/api/gsch/agreements?${params.toString()}`
      )
      setItems(data.data || [])
    } catch (err) {
      setItems([])
      toast.error(err instanceof ApiError ? err.message : 'Failed to load agreements')
    } finally {
      setLoading(false)
    }
  }, [applied])

  const loadMeta = useCallback(async () => {
    try {
      const [orgRes, cityRes, discover] = await Promise.all([
        apiClient.get<GschOrganization[]>('/api/gsch/organizations'),
        apiClient.get<GschPaginated<GschCity>>('/api/gsch/cities?mine=1&limit=50'),
        apiClient.get<GschPaginated<GschCity>>('/api/gsch/cities?limit=50'),
      ])
      setOrgs(orgRes || [])
      const byId = new Map<string, GschCity>()
      for (const c of [...(cityRes.data || []), ...(discover.data || [])]) {
        byId.set(c.id, c)
      }
      setCities(Array.from(byId.values()))
      setForm((f) => ({
        ...f,
        organization_a_id: f.organization_a_id || orgRes?.[0]?.id || '',
      }))
    } catch {
      /* optional */
    }
  }, [])

  useEffect(() => {
    if (authLoading || !user) return
    load()
    loadMeta()
  }, [authLoading, user?.id, load, loadMeta])

  function openCreate() {
    setEditingId(null)
    setForm({
      ...EMPTY_FORM,
      organization_a_id: orgs[0]?.id || '',
    })
    setShowForm(true)
  }

  function openEdit(agreement: GschAgreement) {
    setEditingId(agreement.id)
    setForm({
      organization_a_id: agreement.organization_a_id || '',
      organization_b_id: agreement.organization_b_id || '',
      city_a_id: agreement.city_a_id || '',
      city_b_id: agreement.city_b_id || '',
      title: agreement.title || '',
      template_type: agreement.template_type,
      objectives: agreement.objectives || '',
      duration_label: agreement.duration_label || '',
      responsibilities_a: agreement.responsibilities_a || '',
      responsibilities_b: agreement.responsibilities_b || '',
    })
    setShowForm(true)
  }

  async function saveAgreement(e: React.FormEvent) {
    e.preventDefault()
    if (!form.organization_a_id || !form.organization_b_id || !form.title.trim()) {
      toast.error('Your org, partner org, and title are required')
      return
    }
    setSubmitting(true)
    const payload = {
      ...form,
      city_a_id: form.city_a_id || null,
      city_b_id: form.city_b_id || null,
    }
    try {
      if (editingId) {
        await apiClient.patch(`/api/gsch/agreements/${editingId}`, {
          title: payload.title,
          objectives: payload.objectives,
          duration_label: payload.duration_label,
          responsibilities_a: payload.responsibilities_a,
          responsibilities_b: payload.responsibilities_b,
          city_a_id: payload.city_a_id,
          city_b_id: payload.city_b_id,
        })
        toast.success('Agreement updated')
      } else {
        await apiClient.post('/api/gsch/agreements', payload)
        toast.success('Agreement draft created')
      }
      setShowForm(false)
      setEditingId(null)
      setForm({
        ...EMPTY_FORM,
        organization_a_id: orgs[0]?.id || '',
      })
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(agreement: GschAgreement) {
    const ok = await confirm({
      title: 'Delete agreement?',
      message: `Delete “${agreement.title}”? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (!ok) return
    setDeletingId(agreement.id)
    try {
      await apiClient.delete(`/api/gsch/agreements/${agreement.id}`)
      toast.success('Agreement deleted')
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
    const empty = { status: '' }
    setFilters(empty)
    setApplied(empty)
    setFiltersOpen(false)
  }

  if (authLoading) {
    return <div className={`${GSCH_CARD} h-40 animate-pulse`} />
  }

  if (!user) return <EmptyState title="Sign in required" />

  return (
    <div className="space-y-6">
      {dialog}
      <section className={`${GSCH_CARD} border-amber-500/20 bg-amber-500/5`}>
        <h2 className={GSCH_SECTION_TITLE}>Intent only — not legal e-sign</h2>
        <p className={`${GSCH_MUTED} mt-2`}>{GSCH_AGREEMENT_DISCLAIMER}</p>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className="btn-primary text-sm"
          data-tour="gsch-primary-cta"
          onClick={openCreate}
        >
          New agreement
        </button>
        <GschFiltersButton
          activeCount={activeFilterCount}
          onClick={() => setFiltersOpen(true)}
        />
      </div>

      <GschFilterDrawer
        open={filtersOpen}
        title="Filter agreements"
        description="Narrow agreements by workflow status."
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
          <label className={GSCH_LABEL} htmlFor="gsch-agr-status">
            Status
          </label>
          <select
            id="gsch-agr-status"
            className={`${GSCH_SELECT} w-full`}
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="">All statuses</option>
            {GSCH_AGREEMENT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </GschFilterDrawer>

      <GschFormModal
        open={showForm}
        title={editingId ? 'Edit partnership agreement' : 'Draft partnership agreement'}
        onClose={() => {
          setShowForm(false)
          setEditingId(null)
        }}
        footer={
          <>
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={submitting}
              onClick={() => {
                setShowForm(false)
                setEditingId(null)
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="gsch-agreement-form"
              className="btn-primary text-sm"
              disabled={submitting}
            >
              {submitting
                ? 'Saving…'
                : editingId
                  ? 'Save changes'
                  : 'Create draft'}
            </button>
          </>
        }
      >
        <form id="gsch-agreement-form" className="space-y-3" onSubmit={saveAgreement}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-content-secondary">Your organization</span>
              <select
                className={GSCH_SELECT}
                value={form.organization_a_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, organization_a_id: e.target.value }))
                }
                required
                disabled={Boolean(editingId)}
              >
                <option value="">Select…</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-content-secondary">Partner organization ID</span>
              <input
                className={GSCH_FIELD}
                placeholder="UUID of partner org"
                value={form.organization_b_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, organization_b_id: e.target.value }))
                }
                required
                disabled={Boolean(editingId)}
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-content-secondary">Title</span>
              <input
                className={GSCH_FIELD}
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-content-secondary">Template</span>
              <select
                className={GSCH_SELECT}
                value={form.template_type}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    template_type: e.target.value as GschAgreementTemplateType,
                  }))
                }
                disabled={Boolean(editingId)}
              >
                {GSCH_AGREEMENT_TEMPLATE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-content-secondary">Duration</span>
              <input
                className={GSCH_FIELD}
                value={form.duration_label}
                onChange={(e) =>
                  setForm((f) => ({ ...f, duration_label: e.target.value }))
                }
                placeholder="e.g. 2 years"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-content-secondary">Your city</span>
              <select
                className={GSCH_SELECT}
                value={form.city_a_id}
                onChange={(e) => setForm((f) => ({ ...f, city_a_id: e.target.value }))}
              >
                <option value="">Optional</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.country}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-content-secondary">Partner city</span>
              <select
                className={GSCH_SELECT}
                value={form.city_b_id}
                onChange={(e) => setForm((f) => ({ ...f, city_b_id: e.target.value }))}
              >
                <option value="">Optional</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.country}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-content-secondary">Objectives</span>
              <textarea
                className={`${GSCH_FIELD} min-h-[72px]`}
                value={form.objectives}
                onChange={(e) => setForm((f) => ({ ...f, objectives: e.target.value }))}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-content-secondary">Your responsibilities</span>
              <textarea
                className={`${GSCH_FIELD} min-h-[72px]`}
                value={form.responsibilities_a}
                onChange={(e) =>
                  setForm((f) => ({ ...f, responsibilities_a: e.target.value }))
                }
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-content-secondary">Partner responsibilities</span>
              <textarea
                className={`${GSCH_FIELD} min-h-[72px]`}
                value={form.responsibilities_b}
                onChange={(e) =>
                  setForm((f) => ({ ...f, responsibilities_b: e.target.value }))
                }
              />
            </label>
          </div>
        </form>
      </GschFormModal>

      {loading ? (
        <div className={`${GSCH_CARD} h-40 animate-pulse`} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No agreements yet"
          description="Draft a structured partnership agreement between two organizations."
          action={
            <button type="button" className="btn-primary text-sm" onClick={openCreate}>
              New agreement
            </button>
          }
        />
      ) : (
        <GschDataTable>
          <GschTableHead>
            <GschTableHeadCell>Title</GschTableHeadCell>
            <GschTableHeadCell>Template type</GschTableHeadCell>
            <GschTableHeadCell>Status</GschTableHeadCell>
            <GschTableHeadCell>Orgs</GschTableHeadCell>
            <GschTableHeadCell align="right">Actions</GschTableHeadCell>
          </GschTableHead>
          <GschTableBody>
            {items.map((item) => {
              const orgsLabel = [
                item.organization_a?.name,
                item.organization_b?.name,
              ]
                .filter(Boolean)
                .join(' ↔ ')
              return (
                <GschTableRow
                  key={item.id}
                  onClick={() => router.push(`/global-hub/agreements/${item.id}`)}
                >
                  <GschTableCell className="min-w-[160px]">
                    <p className="font-semibold text-content">{item.title}</p>
                  </GschTableCell>
                  <GschTableCell className="capitalize">
                    {item.template_type.replace(/_/g, ' ')}
                  </GschTableCell>
                  <GschTableCell>
                    <StatusBadge status={item.status} />
                  </GschTableCell>
                  <GschTableCell>{orgsLabel || '—'}</GschTableCell>
                  <GschTableCell align="right">
                    <GschRowActions
                      onView={() => router.push(`/global-hub/agreements/${item.id}`)}
                      onEdit={() => openEdit(item)}
                      onDelete={() => handleDelete(item)}
                      deleting={deletingId === item.id}
                    />
                  </GschTableCell>
                </GschTableRow>
              )
            })}
          </GschTableBody>
        </GschDataTable>
      )}
    </div>
  )
}
