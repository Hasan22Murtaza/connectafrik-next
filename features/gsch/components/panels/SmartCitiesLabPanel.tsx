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
  GSCH_INNOVATION_CHALLENGE_STATUSES,
  GSCH_INNOVATION_FOCUS_AREAS,
  type GschCity,
  type GschInnovationChallenge,
  type GschInnovationChallengeStatus,
  type GschInnovationFocusArea,
  type GschOrganization,
  type GschPaginated,
} from '@/shared/types/gsch'

const EMPTY_FORM = {
  organization_id: '',
  city_id: '',
  title: '',
  summary: '',
  description: '',
  focus_area: 'ai_transportation' as GschInnovationFocusArea,
  country: '',
  continent: '',
  location_label: '',
  prize_or_benefit: '',
  submission_deadline: '',
  external_url: '',
  contact_email: '',
  tags: '',
  status: 'open' as GschInnovationChallengeStatus,
  is_published: false,
}

function toDateInput(value: string | null | undefined) {
  if (!value) return ''
  return value.slice(0, 10)
}

export default function SmartCitiesLabPanel() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { confirm, dialog } = useConfirmDialog()
  const [items, setItems] = useState<GschInnovationChallenge[]>([])
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
  const [proposalTarget, setProposalTarget] =
    useState<GschInnovationChallenge | null>(null)
  const [proposalBusy, setProposalBusy] = useState(false)
  const [proposalTitle, setProposalTitle] = useState('')
  const [proposalBody, setProposalBody] = useState('')
  const [proposalOrgId, setProposalOrgId] = useState('')
  const [proposalEmail, setProposalEmail] = useState('')
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

      const data = await apiClient.get<GschPaginated<GschInnovationChallenge>>(
        `/api/gsch/innovation-challenges?${params.toString()}`
      )
      setItems(data.data || [])
    } catch (err) {
      setItems([])
      toast.error(err instanceof ApiError ? err.message : 'Failed to load challenges')
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

  function openEdit(item: GschInnovationChallenge) {
    setEditingId(item.id)
    setForm({
      organization_id: item.organization_id || orgs[0]?.id || '',
      city_id: item.city_id || '',
      title: item.title || '',
      summary: item.summary || '',
      description: item.description || '',
      focus_area: item.focus_area,
      country: item.country || '',
      continent: item.continent || '',
      location_label: item.location_label || '',
      prize_or_benefit: item.prize_or_benefit || '',
      submission_deadline: toDateInput(item.submission_deadline),
      external_url: item.external_url || '',
      contact_email: item.contact_email || '',
      tags: (item.tags || []).join(', '),
      status: item.status,
      is_published: item.is_published,
    })
    setShowForm(true)
  }

  async function saveChallenge(e: React.FormEvent) {
    e.preventDefault()
    if (!form.organization_id || !form.title.trim()) {
      toast.error('Organization and title are required')
      return
    }
    setSubmitting(true)
    const payload = {
      ...form,
      city_id: form.city_id || null,
      submission_deadline: form.submission_deadline || null,
      tags: form.tags,
    }
    try {
      if (editingId) {
        await apiClient.patch(`/api/gsch/innovation-challenges/${editingId}`, payload)
        toast.success('Challenge updated')
      } else {
        await apiClient.post('/api/gsch/innovation-challenges', payload)
        toast.success('Innovation challenge created')
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

  async function handleDelete(item: GschInnovationChallenge) {
    const ok = await confirm({
      title: 'Delete challenge?',
      message: `Delete “${item.title}”? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (!ok) return
    setDeletingId(item.id)
    try {
      await apiClient.delete(`/api/gsch/innovation-challenges/${item.id}`)
      toast.success('Challenge deleted')
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  async function togglePublish(item: GschInnovationChallenge) {
    setPublishingId(item.id)
    try {
      const updated = await apiClient.patch<GschInnovationChallenge>(
        `/api/gsch/innovation-challenges/${item.id}`,
        { is_published: !item.is_published }
      )
      toast.success(updated.is_published ? 'Published' : 'Unpublished')
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Update failed')
    } finally {
      setPublishingId(null)
    }
  }

  function openProposal(item: GschInnovationChallenge) {
    setProposalTarget(item)
    setProposalTitle('')
    setProposalBody('')
    setProposalOrgId(orgs[0]?.id || '')
    setProposalEmail('')
  }

  async function submitProposal(e: React.FormEvent) {
    e.preventDefault()
    if (!proposalTarget) return
    if (!proposalTitle.trim() || !proposalBody.trim()) {
      toast.error('Title and proposal are required')
      return
    }
    setProposalBusy(true)
    try {
      await apiClient.post(
        `/api/gsch/innovation-challenges/${proposalTarget.id}/submissions`,
        {
          title: proposalTitle,
          proposal: proposalBody,
          organization_id: proposalOrgId || null,
          contact_email: proposalEmail || null,
        }
      )
      toast.success('Proposal submitted')
      setProposalTarget(null)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Submission failed')
    } finally {
      setProposalBusy(false)
    }
  }

  function applyFilters() {
    setApplied(filters)
    setFiltersOpen(false)
  }

  function resetFilters() {
    const empty = { q: '', type: '', country: '', continent: '' }
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
            Post challenge
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
            My challenges
          </button>
          <GschFiltersButton
            activeCount={activeFilterCount}
            onClick={() => setFiltersOpen(true)}
          />
        </div>
      </div>

      <GschFilterDrawer
        open={filtersOpen}
        title="Filter challenges"
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
          <label className={GSCH_LABEL} htmlFor="gsch-innovation-q">
            Search
          </label>
          <input
            id="gsch-innovation-q"
            className={GSCH_FIELD}
            placeholder="Search challenges…"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          />
        </div>
        <div>
          <label className={GSCH_LABEL} htmlFor="gsch-innovation-type">
            Focus area
          </label>
          <select
            id="gsch-innovation-type"
            className={`${GSCH_SELECT} w-full`}
            value={filters.type}
            onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
          >
            <option value="">All focus areas</option>
            {GSCH_INNOVATION_FOCUS_AREAS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={GSCH_LABEL} htmlFor="gsch-innovation-country">
            Country
          </label>
          <input
            id="gsch-innovation-country"
            className={GSCH_FIELD}
            placeholder="Country"
            value={filters.country}
            onChange={(e) => setFilters((f) => ({ ...f, country: e.target.value }))}
          />
        </div>
        <div>
          <label className={GSCH_LABEL} htmlFor="gsch-innovation-continent">
            Continent
          </label>
          <select
            id="gsch-innovation-continent"
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
        title={editingId ? 'Edit innovation challenge' : 'Create innovation challenge'}
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
              form="gsch-innovation-form"
              className="btn-primary text-sm"
              disabled={submitting}
            >
              {submitting ? 'Saving…' : editingId ? 'Save changes' : 'Create'}
            </button>
          </>
        }
      >
        <form id="gsch-innovation-form" onSubmit={saveChallenge} className="space-y-3">
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
            value={form.focus_area}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                focus_area: e.target.value as GschInnovationFocusArea,
              }))
            }
          >
            {GSCH_INNOVATION_FOCUS_AREAS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <select
            className={`${GSCH_SELECT} w-full`}
            value={form.status}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                status: e.target.value as GschInnovationChallengeStatus,
              }))
            }
          >
            {GSCH_INNOVATION_CHALLENGE_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
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
          <input
            className={GSCH_FIELD}
            placeholder="Prize or benefit"
            value={form.prize_or_benefit}
            onChange={(e) =>
              setForm((f) => ({ ...f, prize_or_benefit: e.target.value }))
            }
          />
          <input
            className={GSCH_FIELD}
            type="date"
            value={form.submission_deadline}
            onChange={(e) =>
              setForm((f) => ({ ...f, submission_deadline: e.target.value }))
            }
          />
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
          title={mine ? 'No challenges from your orgs' : 'No published challenges'}
          description="Launch smart-city innovation challenges for partners to solve."
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
                [item.location_label, item.country, item.continent]
                  .filter(Boolean)
                  .join(' · ') || '—'
              const typeLabel =
                GSCH_INNOVATION_FOCUS_AREAS.find((t) => t.value === item.focus_area)
                  ?.label || item.focus_area.replace(/_/g, ' ')
              return (
                <GschTableRow key={item.id} onClick={() => router.push(`/global-hub/smart-cities/${item.id}`)}>
                  <GschTableCell className="min-w-[180px]">
                    <p className="font-semibold text-content">{item.title}</p>
                    <p className="mt-0.5 text-xs text-content-tertiary">
                      {item.organization?.name || '—'}
                    </p>
                  </GschTableCell>
                  <GschTableCell className="capitalize">{typeLabel}</GschTableCell>
                  <GschTableCell>{location}</GschTableCell>
                  <GschTableCell>
                    <StatusBadge
                      status={
                        mine
                          ? item.is_published
                            ? item.status
                            : 'draft'
                          : item.status
                      }
                    />
                  </GschTableCell>
                  <GschTableCell align="right">
                    <GschRowActions
                      onView={() => router.push(`/global-hub/smart-cities/${item.id}`)}
                      onPublish={() => togglePublish(item)}
                      publishLabel={item.is_published ? 'Unpublish' : 'Publish'}
                      publishing={publishingId === item.id}
                      onEnquire={
                        item.is_published && item.status === 'open'
                          ? () => openProposal(item)
                          : undefined
                      }
                      enquireLabel="Submit proposal"
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

            <GschFormModal
        open={Boolean(proposalTarget)}
        title="Submit proposal"
        description={proposalTarget?.title}
        onClose={() => setProposalTarget(null)}
        footer={
          <>
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={proposalBusy}
              onClick={() => setProposalTarget(null)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="gsch-smart-cities-proposal"
              className="btn-primary text-sm"
              disabled={proposalBusy}
            >
              {proposalBusy ? 'Submitting…' : 'Submit proposal'}
            </button>
          </>
        }
      >
        <form
          id="gsch-smart-cities-proposal"
          onSubmit={submitProposal}
          className="space-y-3"
        >
          {orgs.length > 0 ? (
            <select
              className={`${GSCH_SELECT} w-full`}
              value={proposalOrgId}
              onChange={(e) => setProposalOrgId(e.target.value)}
            >
              <option value="">Personal submission</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          ) : null}
          <input
            className={GSCH_FIELD}
            placeholder="Proposal title"
            value={proposalTitle}
            onChange={(e) => setProposalTitle(e.target.value)}
            required
          />
          <textarea
            className={GSCH_FIELD}
            rows={4}
            placeholder="Proposal details"
            value={proposalBody}
            onChange={(e) => setProposalBody(e.target.value)}
            required
          />
          <input
            className={GSCH_FIELD}
            placeholder="Contact email (optional)"
            value={proposalEmail}
            onChange={(e) => setProposalEmail(e.target.value)}
          />
        </form>
      </GschFormModal>
    </div>
  )
}
