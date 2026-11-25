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
  GSCH_SELECT,
} from '@/features/gsch/constants/styles'
import {
  GSCH_CONTINENTS,
  GSCH_EDUCATION_PROGRAM_TYPES,
  type GschCity,
  type GschEducationProgram,
  type GschEducationProgramType,
  type GschOrganization,
  type GschPaginated,
} from '@/shared/types/gsch'

const EMPTY_FORM = {
  organization_id: '',
  city_id: '',
  title: '',
  summary: '',
  description: '',
  program_type: 'student_exchange' as GschEducationProgramType,
  institution_name: '',
  country: '',
  continent: '',
  location_label: '',
  eligibility: '',
  duration_label: '',
  application_deadline: '',
  external_url: '',
  contact_email: '',
  tags: '',
  is_published: false,
}

function toDateInput(value: string | null | undefined) {
  if (!value) return ''
  return value.slice(0, 10)
}

export default function EducationExchangePanel() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { confirm, dialog } = useConfirmDialog()
  const [items, setItems] = useState<GschEducationProgram[]>([])
  const [orgs, setOrgs] = useState<GschOrganization[]>([])
  const [cities, setCities] = useState<GschCity[]>([])
  const [loading, setLoading] = useState(true)
  const [mine, setMine] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    q: '',
    type: '',
    country: '',
    continent: '',
  })
  const [applied, setApplied] = useState(filters)
  const [form, setForm] = useState(EMPTY_FORM)

  const activeFilterCount = countActiveFilters(applied)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('limit', '30')
      if (mine) params.set('mine', '1')
      if (applied.q) params.set('q', applied.q)
      if (applied.type) params.set('type', applied.type)
      if (applied.country) params.set('country', applied.country)
      if (applied.continent) params.set('continent', applied.continent)

      const data = await apiClient.get<GschPaginated<GschEducationProgram>>(
        `/api/gsch/education-programs?${params.toString()}`
      )
      setItems(data.data || [])
    } catch (err) {
      setItems([])
      toast.error(err instanceof ApiError ? err.message : 'Failed to load programs')
    } finally {
      setLoading(false)
    }
  }, [mine, applied])

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

  function openEdit(program: GschEducationProgram) {
    setEditingId(program.id)
    setForm({
      organization_id: program.organization_id || orgs[0]?.id || '',
      city_id: program.city_id || '',
      title: program.title || '',
      summary: program.summary || '',
      description: program.description || '',
      program_type: program.program_type,
      institution_name: program.institution_name || '',
      country: program.country || '',
      continent: program.continent || '',
      location_label: program.location_label || '',
      eligibility: program.eligibility || '',
      duration_label: program.duration_label || '',
      application_deadline: toDateInput(program.application_deadline),
      external_url: program.external_url || '',
      contact_email: program.contact_email || '',
      tags: (program.tags || []).join(', '),
      is_published: program.is_published,
    })
    setShowForm(true)
  }

  async function saveProgram(e: React.FormEvent) {
    e.preventDefault()
    if (!form.organization_id || !form.title.trim()) {
      toast.error('Organization and title are required')
      return
    }
    setSubmitting(true)
    const payload = {
      ...form,
      city_id: form.city_id || null,
      application_deadline: form.application_deadline || null,
      tags: form.tags,
    }
    try {
      if (editingId) {
        await apiClient.patch(`/api/gsch/education-programs/${editingId}`, payload)
        toast.success('Education program updated')
      } else {
        await apiClient.post('/api/gsch/education-programs', payload)
        toast.success('Education program created')
        setMine(true)
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

  async function handleDelete(program: GschEducationProgram) {
    const ok = await confirm({
      title: 'Delete education program?',
      message: `Delete “${program.title}”? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (!ok) return
    setDeletingId(program.id)
    try {
      await apiClient.delete(`/api/gsch/education-programs/${program.id}`)
      toast.success('Education program deleted')
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  async function togglePublish(program: GschEducationProgram) {
    setPublishingId(program.id)
    try {
      const updated = await apiClient.patch<GschEducationProgram>(
        `/api/gsch/education-programs/${program.id}`,
        { is_published: !program.is_published }
      )
      toast.success(updated.is_published ? 'Published' : 'Unpublished')
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Update failed')
    } finally {
      setPublishingId(null)
    }
  }

  function applyFilters() {
    setApplied(filters)
    setFiltersOpen(false)
  }

  function resetFilters() {
    const empty = {
      q: '',
      type: '',
      country: '',
      continent: '',
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        {orgs.length > 0 ? (
          <button
            type="button"
            className="btn-primary text-sm"
            data-tour="gsch-primary-cta"
            onClick={openCreate}
          >
            Post program
          </button>
        ) : (
          <span />
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={!mine ? 'btn-primary text-sm' : 'btn-secondary text-sm'}
            onClick={() => setMine(false)}
          >
            Discover
          </button>
          <button
            type="button"
            className={mine ? 'btn-primary text-sm' : 'btn-secondary text-sm'}
            onClick={() => setMine(true)}
          >
            My posts
          </button>
          <GschFiltersButton
            activeCount={activeFilterCount}
            onClick={() => setFiltersOpen(true)}
          />
        </div>
      </div>

      <GschFilterDrawer
        open={filtersOpen}
        title="Filter education programs"
        description="Narrow programs by type and location."
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
          <label className={GSCH_LABEL} htmlFor="gsch-edu-q">
            Search
          </label>
          <input
            id="gsch-edu-q"
            className={GSCH_FIELD}
            placeholder="Search programs…"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          />
        </div>
        <div>
          <label className={GSCH_LABEL} htmlFor="gsch-edu-type">
            Type
          </label>
          <select
            id="gsch-edu-type"
            className={`${GSCH_SELECT} w-full`}
            value={filters.type}
            onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
          >
            <option value="">All program types</option>
            {GSCH_EDUCATION_PROGRAM_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={GSCH_LABEL} htmlFor="gsch-edu-country">
            Country
          </label>
          <input
            id="gsch-edu-country"
            className={GSCH_FIELD}
            placeholder="Country"
            value={filters.country}
            onChange={(e) => setFilters((f) => ({ ...f, country: e.target.value }))}
          />
        </div>
        <div>
          <label className={GSCH_LABEL} htmlFor="gsch-edu-continent">
            Continent
          </label>
          <select
            id="gsch-edu-continent"
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
        title={editingId ? 'Edit education program' : 'Create education program'}
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
              form="gsch-education-form"
              className="btn-primary text-sm"
              disabled={submitting}
            >
              {submitting ? 'Saving…' : editingId ? 'Save changes' : 'Create'}
            </button>
          </>
        }
      >
        <form id="gsch-education-form" onSubmit={saveProgram} className="space-y-3">
          <select
            className={`${GSCH_SELECT} w-full`}
            value={form.organization_id}
            onChange={(e) =>
              setForm((f) => ({ ...f, organization_id: e.target.value }))
            }
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
          <select
            className={`${GSCH_SELECT} w-full`}
            value={form.program_type}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                program_type: e.target.value as GschEducationProgramType,
              }))
            }
          >
            {GSCH_EDUCATION_PROGRAM_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
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
          <input
            className={GSCH_FIELD}
            placeholder="Institution name"
            value={form.institution_name}
            onChange={(e) =>
              setForm((f) => ({ ...f, institution_name: e.target.value }))
            }
          />
          <input
            className={GSCH_FIELD}
            placeholder="Summary"
            value={form.summary}
            onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
          />
          <textarea
            className={GSCH_FIELD}
            rows={3}
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <textarea
            className={GSCH_FIELD}
            rows={2}
            placeholder="Eligibility"
            value={form.eligibility}
            onChange={(e) => setForm((f) => ({ ...f, eligibility: e.target.value }))}
          />
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
              onChange={(e) =>
                setForm((f) => ({ ...f, location_label: e.target.value }))
              }
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              className={GSCH_FIELD}
              placeholder="Duration"
              value={form.duration_label}
              onChange={(e) =>
                setForm((f) => ({ ...f, duration_label: e.target.value }))
              }
            />
            <input
              className={GSCH_FIELD}
              type="date"
              value={form.application_deadline}
              onChange={(e) =>
                setForm((f) => ({ ...f, application_deadline: e.target.value }))
              }
            />
          </div>
          <input
            className={GSCH_FIELD}
            placeholder="External URL"
            value={form.external_url}
            onChange={(e) => setForm((f) => ({ ...f, external_url: e.target.value }))}
          />
          <input
            className={GSCH_FIELD}
            placeholder="Contact email"
            value={form.contact_email}
            onChange={(e) =>
              setForm((f) => ({ ...f, contact_email: e.target.value }))
            }
          />
          <input
            className={GSCH_FIELD}
            placeholder="Tags (comma-separated)"
            value={form.tags}
            onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
          />
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
          title={mine ? 'No programs from your orgs' : 'No published programs'}
          description="Post student exchanges, scholarships, or research collaborations."
        />
      ) : (
        <GschDataTable>
          <GschTableHead>
            <GschTableHeadCell>Title</GschTableHeadCell>
            <GschTableHeadCell>Type</GschTableHeadCell>
            <GschTableHeadCell>Location</GschTableHeadCell>
            <GschTableHeadCell>Status</GschTableHeadCell>
            <GschTableHeadCell align="right">Actions</GschTableHeadCell>
          </GschTableHead>
          <GschTableBody>
            {items.map((item) => {
              const location =
                [item.country, item.continent].filter(Boolean).join(' · ') || '—'
              const typeLabel =
                GSCH_EDUCATION_PROGRAM_TYPES.find((t) => t.value === item.program_type)
                  ?.label || item.program_type.replace(/_/g, ' ')
              return (
                <GschTableRow
                  key={item.id}
                  onClick={() => router.push(`/global-hub/education/${item.id}`)}
                >
                  <GschTableCell className="min-w-[180px]">
                    <p className="font-semibold text-content">{item.title}</p>
                    <p className="mt-0.5 text-xs text-content-tertiary">
                      {item.organization?.name || '—'}
                    </p>
                  </GschTableCell>
                  <GschTableCell className="capitalize">{typeLabel}</GschTableCell>
                  <GschTableCell>{location}</GschTableCell>
                  <GschTableCell>
                    {mine ? (
                      <StatusBadge
                        status={item.is_published ? 'published' : 'draft'}
                      />
                    ) : (
                      <StatusBadge status="published" />
                    )}
                  </GschTableCell>
                  <GschTableCell align="right">
                    <GschRowActions
                      onView={() => router.push(`/global-hub/education/${item.id}`)}
                      onPublish={() => togglePublish(item)}
                      publishLabel={item.is_published ? 'Unpublish' : 'Publish'}
                      publishing={publishingId === item.id}
                      onEnquire={
                        item.is_published
                          ? () =>
                              router.push(
                                `/global-hub/education/${item.id}?apply=1`
                              )
                          : undefined
                      }
                      enquireLabel="Apply"
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
