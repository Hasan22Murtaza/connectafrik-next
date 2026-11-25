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
  GSCH_CONTINENTS,
  GSCH_INVESTMENT_DISCLAIMER,
  GSCH_PROJECT_CATEGORIES,
  GSCH_PROJECT_STAGES,
  type GschCity,
  type GschOrganization,
  type GschPaginated,
  type GschProject,
  type GschProjectCategory,
  type GschProjectStage,
} from '@/shared/types/gsch'

const EMPTY_FORM = {
  organization_id: '',
  city_id: '',
  title: '',
  description: '',
  category: 'infrastructure' as GschProjectCategory,
  country: '',
  continent: '',
  location_label: '',
  estimated_value_amount: '',
  funding_required_amount: '',
  investment_structure: '',
  project_stage: 'concept' as GschProjectStage,
  required_partners: '',
  contact_email: '',
  contact_name: '',
  is_published: false,
  disclaimer_acknowledged: false,
}

function formatMoney(amount: number | null, currency: string | null) {
  if (amount == null) return '—'
  const cur = currency || 'USD'
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: cur,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${cur} ${amount}`
  }
}

export default function InvestmentMarketplacePanel() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { confirm, dialog } = useConfirmDialog()
  const [items, setItems] = useState<GschProject[]>([])
  const [orgs, setOrgs] = useState<GschOrganization[]>([])
  const [cities, setCities] = useState<GschCity[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'discover' | 'mine' | 'saved'>('discover')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    q: '',
    category: '',
    country: '',
    continent: '',
    stage: '',
  })
  const [applied, setApplied] = useState(filters)
  const [form, setForm] = useState(EMPTY_FORM)

  const activeFilterCount = countActiveFilters(applied)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('limit', '30')
      if (mode === 'mine') params.set('mine', '1')
      if (mode === 'saved') params.set('saved', '1')
      if (applied.q) params.set('q', applied.q)
      if (applied.category) params.set('category', applied.category)
      if (applied.country) params.set('country', applied.country)
      if (applied.continent) params.set('continent', applied.continent)
      if (applied.stage) params.set('stage', applied.stage)

      const data = await apiClient.get<GschPaginated<GschProject>>(
        `/api/gsch/projects?${params.toString()}`
      )
      setItems(data.data || [])
    } catch (err) {
      setItems([])
      toast.error(err instanceof ApiError ? err.message : 'Failed to load projects')
    } finally {
      setLoading(false)
    }
  }, [mode, applied])

  const loadMeta = useCallback(async () => {
    try {
      const [orgRes, cityRes] = await Promise.all([
        apiClient.get<GschOrganization[]>('/api/gsch/organizations?mine=1'),
        apiClient.get<GschPaginated<GschCity>>('/api/gsch/cities?mine=1&limit=50'),
      ])
      setOrgs(orgRes || [])
      setCities(cityRes.data || [])
      setForm((f) => ({
        ...f,
        organization_id: f.organization_id || orgRes?.[0]?.id || '',
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
      organization_id: orgs[0]?.id || '',
    })
    setShowForm(true)
  }

  function openEdit(project: GschProject) {
    setEditingId(project.id)
    setForm({
      organization_id: project.organization_id || orgs[0]?.id || '',
      city_id: project.city_id || '',
      title: project.title || '',
      description: project.description || '',
      category: project.category,
      country: project.country || '',
      continent: project.continent || '',
      location_label: project.location_label || '',
      estimated_value_amount:
        project.estimated_value_amount != null
          ? String(project.estimated_value_amount)
          : '',
      funding_required_amount:
        project.funding_required_amount != null
          ? String(project.funding_required_amount)
          : '',
      investment_structure: project.investment_structure || '',
      project_stage: project.project_stage,
      required_partners: (project.required_partners || []).join(', '),
      contact_email: project.contact_email || '',
      contact_name: project.contact_name || '',
      is_published: project.is_published,
      disclaimer_acknowledged: project.disclaimer_acknowledged,
    })
    setShowForm(true)
  }

  async function saveProject(e: React.FormEvent) {
    e.preventDefault()
    if (!form.organization_id || !form.title.trim()) {
      toast.error('Organization and title are required')
      return
    }
    if (!form.disclaimer_acknowledged) {
      toast.error('You must acknowledge the marketplace disclaimer')
      return
    }
    setSubmitting(true)
    const payload = {
      ...form,
      city_id: form.city_id || null,
      estimated_value_amount: form.estimated_value_amount || null,
      funding_required_amount: form.funding_required_amount || null,
      required_partners: form.required_partners,
    }
    try {
      if (editingId) {
        await apiClient.patch(`/api/gsch/projects/${editingId}`, payload)
        toast.success('Project updated')
      } else {
        await apiClient.post('/api/gsch/projects', payload)
        toast.success('Project listed')
        setMode('mine')
      }
      setShowForm(false)
      setEditingId(null)
      setForm({
        ...EMPTY_FORM,
        organization_id: orgs[0]?.id || '',
      })
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(project: GschProject) {
    const ok = await confirm({
      title: 'Delete project?',
      message: `Delete “${project.title}”? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (!ok) return
    setDeletingId(project.id)
    try {
      await apiClient.delete(`/api/gsch/projects/${project.id}`)
      toast.success('Project deleted')
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  async function togglePublish(project: GschProject) {
    setPublishingId(project.id)
    try {
      const updated = await apiClient.patch<GschProject>(
        `/api/gsch/projects/${project.id}`,
        { is_published: !project.is_published }
      )
      toast.success(updated.is_published ? 'Published' : 'Unpublished')
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Update failed')
    } finally {
      setPublishingId(null)
    }
  }

  async function toggleSave(project: GschProject) {
    setSavingId(project.id)
    try {
      const res = await apiClient.post<{ saved: boolean }>(
        `/api/gsch/projects/${project.id}/save`,
        {}
      )
      toast.success(res.saved ? 'Saved' : 'Removed from saved')
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Save failed')
    } finally {
      setSavingId(null)
    }
  }

  function applyFilters() {
    setApplied(filters)
    setFiltersOpen(false)
  }

  function resetFilters() {
    const empty = {
      q: '',
      category: '',
      country: '',
      continent: '',
      stage: '',
    }
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
        <h2 className={GSCH_SECTION_TITLE}>Investment marketplace</h2>
        <p className={`${GSCH_MUTED} mt-2`}>{GSCH_INVESTMENT_DISCLAIMER}</p>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {orgs.length > 0 ? (
          <button
            type="button"
            className="btn-primary text-sm"
            data-tour="gsch-primary-cta"
            onClick={openCreate}
          >
            List project
          </button>
        ) : (
          <span data-tour="gsch-primary-cta" />
        )}
        <div className="flex flex-wrap gap-2" data-tour="gsch-tabs">
          <button
            type="button"
            className={mode === 'discover' ? 'btn-primary text-sm' : 'btn-secondary text-sm'}
            onClick={() => setMode('discover')}
          >
            Discover
          </button>
          <button
            type="button"
            className={mode === 'mine' ? 'btn-primary text-sm' : 'btn-secondary text-sm'}
            onClick={() => setMode('mine')}
          >
            My projects
          </button>
          <button
            type="button"
            className={mode === 'saved' ? 'btn-primary text-sm' : 'btn-secondary text-sm'}
            onClick={() => setMode('saved')}
          >
            Saved
          </button>
          <GschFiltersButton
            activeCount={activeFilterCount}
            onClick={() => setFiltersOpen(true)}
          />
        </div>
      </div>

      <GschFilterDrawer
        open={filtersOpen}
        title="Filter projects"
        description="Narrow the investment marketplace by category, stage, and location."
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
          <label className={GSCH_LABEL} htmlFor="gsch-inv-q">
            Search
          </label>
          <input
            id="gsch-inv-q"
            className={GSCH_FIELD}
            placeholder="Search projects…"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          />
        </div>
        <div>
          <label className={GSCH_LABEL} htmlFor="gsch-inv-category">
            Category
          </label>
          <select
            id="gsch-inv-category"
            className={`${GSCH_SELECT} w-full`}
            value={filters.category}
            onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
          >
            <option value="">All categories</option>
            {GSCH_PROJECT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={GSCH_LABEL} htmlFor="gsch-inv-stage">
            Stage
          </label>
          <select
            id="gsch-inv-stage"
            className={`${GSCH_SELECT} w-full`}
            value={filters.stage}
            onChange={(e) => setFilters((f) => ({ ...f, stage: e.target.value }))}
          >
            <option value="">All stages</option>
            {GSCH_PROJECT_STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={GSCH_LABEL} htmlFor="gsch-inv-country">
            Country
          </label>
          <input
            id="gsch-inv-country"
            className={GSCH_FIELD}
            placeholder="Country"
            value={filters.country}
            onChange={(e) => setFilters((f) => ({ ...f, country: e.target.value }))}
          />
        </div>
        <div>
          <label className={GSCH_LABEL} htmlFor="gsch-inv-continent">
            Continent
          </label>
          <select
            id="gsch-inv-continent"
            className={`${GSCH_SELECT} w-full`}
            value={filters.continent}
            onChange={(e) => setFilters((f) => ({ ...f, continent: e.target.value }))}
          >
            <option value="">All continents</option>
            {GSCH_CONTINENTS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </GschFilterDrawer>

            <GschFormModal
        open={showForm}
        title={editingId ? 'Edit investment project' : 'List investment project'}
        description="No payments are processed on this platform. Listing is for discovery and contact only."
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
              form="gsch-project-form"
              className="btn-primary text-sm"
              disabled={submitting}
            >
              {submitting ? 'Saving…' : editingId ? 'Save changes' : 'Create project'}
            </button>
          </>
        }
      >
        <form id="gsch-project-form" onSubmit={saveProject} className="space-y-3">
          <select
            className={`${GSCH_SELECT} w-full`}
            value={form.organization_id}
            onChange={(e) => setForm((f) => ({ ...f, organization_id: e.target.value }))}
            required
            disabled={Boolean(editingId)}
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <select
            className={`${GSCH_SELECT} w-full`}
            value={form.city_id}
            onChange={(e) => setForm((f) => ({ ...f, city_id: e.target.value }))}
          >
            <option value="">City (optional)</option>
            {cities
              .filter((c) => c.organization_id === form.organization_id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
          <input
            className={GSCH_FIELD}
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
          />
          <textarea
            className={GSCH_FIELD}
            rows={3}
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              className={GSCH_SELECT}
              value={form.category}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  category: e.target.value as GschProjectCategory,
                }))
              }
            >
              {GSCH_PROJECT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <select
              className={GSCH_SELECT}
              value={form.project_stage}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  project_stage: e.target.value as GschProjectStage,
                }))
              }
            >
              {GSCH_PROJECT_STAGES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              className={GSCH_FIELD}
              placeholder="Country"
              value={form.country}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
            />
            <select
              className={GSCH_SELECT}
              value={form.continent}
              onChange={(e) => setForm((f) => ({ ...f, continent: e.target.value }))}
            >
              <option value="">Continent</option>
              {GSCH_CONTINENTS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              className={GSCH_FIELD}
              placeholder="Location label"
              value={form.location_label}
              onChange={(e) => setForm((f) => ({ ...f, location_label: e.target.value }))}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              className={GSCH_FIELD}
              type="number"
              min="0"
              placeholder="Estimated value (USD)"
              value={form.estimated_value_amount}
              onChange={(e) =>
                setForm((f) => ({ ...f, estimated_value_amount: e.target.value }))
              }
            />
            <input
              className={GSCH_FIELD}
              type="number"
              min="0"
              placeholder="Funding required (USD)"
              value={form.funding_required_amount}
              onChange={(e) =>
                setForm((f) => ({ ...f, funding_required_amount: e.target.value }))
              }
            />
          </div>
          <input
            className={GSCH_FIELD}
            placeholder="Investment structure"
            value={form.investment_structure}
            onChange={(e) =>
              setForm((f) => ({ ...f, investment_structure: e.target.value }))
            }
          />
          <input
            className={GSCH_FIELD}
            placeholder="Required partners (comma-separated)"
            value={form.required_partners}
            onChange={(e) =>
              setForm((f) => ({ ...f, required_partners: e.target.value }))
            }
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              className={GSCH_FIELD}
              placeholder="Contact name"
              value={form.contact_name}
              onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
            />
            <input
              className={GSCH_FIELD}
              placeholder="Contact email"
              value={form.contact_email}
              onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
            />
          </div>
          <label className="flex items-start gap-2 text-sm text-content-secondary">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.disclaimer_acknowledged}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  disclaimer_acknowledged: e.target.checked,
                }))
              }
              required
            />
            <span>{GSCH_INVESTMENT_DISCLAIMER}</span>
          </label>
          <label className="flex items-center gap-2 text-sm text-content-secondary">
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={(e) =>
                setForm((f) => ({ ...f, is_published: e.target.checked }))
              }
            />
            Publish immediately
          </label>
        </form>
      </GschFormModal>

      {loading ? (
        <div className={`${GSCH_CARD} h-40 animate-pulse`} />
      ) : items.length === 0 ? (
        <EmptyState
          title={
            mode === 'saved'
              ? 'No saved projects'
              : mode === 'mine'
                ? 'No projects from your orgs'
                : 'No published projects'
          }
          description="List a project for discovery — no payments are processed here."
        />
      ) : (
        <GschDataTable>
          <GschTableHead>
            <GschTableHeadCell>Project</GschTableHeadCell>
            <GschTableHeadCell>Category</GschTableHeadCell>
            <GschTableHeadCell>Stage</GschTableHeadCell>
            <GschTableHeadCell>Location</GschTableHeadCell>
            <GschTableHeadCell>Funding</GschTableHeadCell>
            <GschTableHeadCell align="right">Actions</GschTableHeadCell>
          </GschTableHead>
          <GschTableBody>
            {items.map((item) => {
              const location =
                [item.country, item.continent].filter(Boolean).join(' · ') || '—'
              return (
                <GschTableRow
                  key={item.id}
                  onClick={() => router.push(`/global-hub/investment/${item.id}`)}
                >
                  <GschTableCell className="min-w-[180px]">
                    <p className="font-semibold text-content">{item.title}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-content-tertiary">
                      <span>{item.organization?.name || '—'}</span>
                      {mode === 'mine' ? (
                        <StatusBadge
                          status={item.is_published ? 'published' : 'draft'}
                        />
                      ) : null}
                    </div>
                  </GschTableCell>
                  <GschTableCell className="capitalize">
                    {item.category.replace(/_/g, ' ')}
                  </GschTableCell>
                  <GschTableCell>
                    <StatusBadge status={item.project_stage} />
                  </GschTableCell>
                  <GschTableCell>{location}</GschTableCell>
                  <GschTableCell>
                    {formatMoney(
                      item.funding_required_amount,
                      item.funding_required_currency
                    )}
                  </GschTableCell>
                  <GschTableCell align="right">
                    <GschRowActions
                      onView={() => router.push(`/global-hub/investment/${item.id}`)}
                      onSave={() => toggleSave(item)}
                      saveLabel={item.is_saved ? 'Unsave' : 'Save'}
                      saving={savingId === item.id}
                      onPublish={() => togglePublish(item)}
                      publishLabel={item.is_published ? 'Unpublish' : 'Publish'}
                      publishing={publishingId === item.id}
                      onEnquire={
                        item.is_published
                          ? () =>
                              router.push(
                                `/global-hub/investment/${item.id}?interest=1`
                              )
                          : undefined
                      }
                      enquireLabel="Express interest"
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
