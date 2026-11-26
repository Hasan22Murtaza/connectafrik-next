'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import EmptyState from '@/features/gsch/components/EmptyState'
import EventCard from '@/features/gsch/components/EventCard'
import GschHubTabs from '@/features/gsch/components/GschHubTabs'
import GschSearchBar from '@/features/gsch/components/GschSearchBar'
import GschSectionHeader from '@/features/gsch/components/GschSectionHeader'
import GschSkeleton from '@/features/gsch/components/GschSkeleton'
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
  GSCH_COUNT_BADGE,
  GSCH_FIELD,
  GSCH_LABEL,
  GSCH_SELECT,
  GSCH_TOOLBAR,
} from '@/features/gsch/constants/styles'
import {
  GSCH_CONTINENTS,
  GSCH_EVENT_TYPES,
  type GschCity,
  type GschEvent,
  type GschEventType,
  type GschOrganization,
  type GschPaginated,
} from '@/shared/types/gsch'

const EMPTY_FORM = {
  organization_id: '',
  city_id: '',
  title: '',
  summary: '',
  description: '',
  event_type: 'conference' as GschEventType,
  country: '',
  continent: '',
  location_label: '',
  starts_at: '',
  ends_at: '',
  external_url: '',
  contact_email: '',
  tags: '',
  is_published: false,
}

function toDatetimeLocal(value: string | null | undefined) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value.slice(0, 16)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatEventDates(startsAt: string | null, endsAt: string | null) {
  if (!startsAt && !endsAt) return null
  const fmt = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return iso.slice(0, 10)
    }
  }
  if (startsAt && endsAt) return `${fmt(startsAt)} – ${fmt(endsAt)}`
  if (startsAt) return fmt(startsAt)
  return endsAt ? fmt(endsAt) : null
}

export default function EventsPanel() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { confirm, dialog } = useConfirmDialog()
  const [items, setItems] = useState<GschEvent[]>([])
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
    event_type: '',
    country: '',
    continent: '',
  })
  const [applied, setApplied] = useState(filters)
  const [form, setForm] = useState(EMPTY_FORM)

  const activeFilterCount = countActiveFilters(applied)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '30' })
      if (mine) params.set('mine', '1')
      else params.set('upcoming', '0')
      if (applied.q) params.set('q', applied.q)
      if (applied.event_type) params.set('event_type', applied.event_type)
      if (applied.country) params.set('country', applied.country)
      if (applied.continent) params.set('continent', applied.continent)
      const data = await apiClient.get<GschPaginated<GschEvent>>(
        `/api/gsch/events?${params.toString()}`
      )
      setItems(data.data || [])
    } catch (err) {
      setItems([])
      toast.error(err instanceof ApiError ? err.message : 'Failed to load events')
    } finally {
      setLoading(false)
    }
  }, [mine, applied])

  const loadMeta = useCallback(async () => {
    try {
      const [orgRes, cityRes] = await Promise.all([
        apiClient.get<GschOrganization[]>('/api/gsch/organizations'),
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

  function openEdit(item: GschEvent) {
    setEditingId(item.id)
    setForm({
      organization_id: item.organization_id || orgs[0]?.id || '',
      city_id: item.city_id || '',
      title: item.title || '',
      summary: item.summary || '',
      description: item.description || '',
      event_type: item.event_type,
      country: item.country || '',
      continent: item.continent || '',
      location_label: item.location_label || '',
      starts_at: toDatetimeLocal(item.starts_at),
      ends_at: toDatetimeLocal(item.ends_at),
      external_url: item.external_url || '',
      contact_email: item.contact_email || '',
      tags: (item.tags || []).join(', '),
      is_published: item.is_published,
    })
    setShowForm(true)
  }

  async function saveEvent(e: React.FormEvent) {
    e.preventDefault()
    if (!form.organization_id || !form.title.trim()) {
      toast.error('Organization and title are required')
      return
    }
    setSubmitting(true)
    const payload = {
      ...form,
      city_id: form.city_id || null,
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
      tags: form.tags,
    }
    try {
      if (editingId) {
        await apiClient.patch(`/api/gsch/events/${editingId}`, payload)
        toast.success('Event updated')
      } else {
        await apiClient.post('/api/gsch/events', payload)
        toast.success('Event created')
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

  async function handleDelete(item: GschEvent) {
    const ok = await confirm({
      title: 'Delete event?',
      message: `Delete “${item.title}”? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (!ok) return
    setDeletingId(item.id)
    try {
      await apiClient.delete(`/api/gsch/events/${item.id}`)
      toast.success('Event deleted')
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  async function togglePublish(item: GschEvent) {
    setPublishingId(item.id)
    try {
      const updated = await apiClient.patch<GschEvent>(
        `/api/gsch/events/${item.id}`,
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

  function applyFilters() {
    setApplied(filters)
    setFiltersOpen(false)
  }

  function resetFilters() {
    const empty = { q: '', event_type: '', country: '', continent: '' }
    setFilters(empty)
    setApplied(empty)
    setFiltersOpen(false)
  }

  function applySearch() {
    setApplied((a) => ({ ...a, q: filters.q }))
  }

  if (authLoading) return <GschSkeleton variant="table" />
  if (!user) return <EmptyState title="Sign in required" />

  return (
    <div className="space-y-6">
      {dialog}

      <div data-tour="gsch-tabs">
        <GschHubTabs
          aria-label="Global events"
          tabs={[
            { id: 'discover', label: 'Discover' },
            { id: 'mine', label: 'My events' },
          ]}
          activeId={mine ? 'mine' : 'discover'}
          onChange={(id) => setMine(id === 'mine')}
        />
      </div>

      <GschSectionHeader
        title={mine ? 'Your events' : 'Upcoming events'}
        badge={
          !loading && items.length > 0 ? (
            <span className={GSCH_COUNT_BADGE}>{items.length}</span>
          ) : null
        }
      >
        <button
          type="button"
          className="btn-primary text-sm"
          data-tour="gsch-primary-cta"
          onClick={openCreate}
        >
          Publish event
        </button>
        <GschFiltersButton
          activeCount={activeFilterCount}
          onClick={() => setFiltersOpen(true)}
        />
      </GschSectionHeader>

      <div className={GSCH_TOOLBAR}>
        <GschSearchBar
          value={filters.q}
          onChange={(q) => setFilters((f) => ({ ...f, q }))}
          onSubmit={applySearch}
          placeholder="Search events…"
          className="sm:max-w-md"
        />
      </div>

      <GschFilterDrawer
        open={filtersOpen}
        title="Filter events"
        description="Narrow events by type and location."
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
          <label className={GSCH_LABEL} htmlFor="gsch-events-q">
            Search
          </label>
          <input
            id="gsch-events-q"
            className={GSCH_FIELD}
            placeholder="Search events…"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          />
        </div>
        <div>
          <label className={GSCH_LABEL} htmlFor="gsch-events-type">
            Event type
          </label>
          <select
            id="gsch-events-type"
            className={`${GSCH_SELECT} w-full`}
            value={filters.event_type}
            onChange={(e) =>
              setFilters((f) => ({ ...f, event_type: e.target.value }))
            }
          >
            <option value="">All types</option>
            {GSCH_EVENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={GSCH_LABEL} htmlFor="gsch-events-country">
            Country
          </label>
          <input
            id="gsch-events-country"
            className={GSCH_FIELD}
            placeholder="Country"
            value={filters.country}
            onChange={(e) => setFilters((f) => ({ ...f, country: e.target.value }))}
          />
        </div>
        <div>
          <label className={GSCH_LABEL} htmlFor="gsch-events-continent">
            Continent
          </label>
          <select
            id="gsch-events-continent"
            className={`${GSCH_SELECT} w-full`}
            value={filters.continent}
            onChange={(e) =>
              setFilters((f) => ({ ...f, continent: e.target.value }))
            }
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
        title={editingId ? 'Edit event' : 'Publish event'}
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
              form="gsch-event-form"
              className="btn-primary text-sm"
              disabled={submitting}
            >
              {submitting ? 'Saving…' : editingId ? 'Save changes' : 'Create event'}
            </button>
          </>
        }
      >
        <form id="gsch-event-form" className="space-y-3" onSubmit={saveEvent}>
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              className={GSCH_SELECT}
              value={form.organization_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, organization_id: e.target.value }))
              }
              required
              disabled={Boolean(editingId)}
            >
              <option value="">Organization…</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <select
              className={GSCH_SELECT}
              value={form.event_type}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  event_type: e.target.value as GschEventType,
                }))
              }
            >
              {GSCH_EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <input
              className={`${GSCH_FIELD} sm:col-span-2`}
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
            <input
              className={`${GSCH_FIELD} sm:col-span-2`}
              placeholder="Summary"
              value={form.summary}
              onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
            />
            <textarea
              className={`${GSCH_FIELD} min-h-[80px] sm:col-span-2`}
              placeholder="Description"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
            <select
              className={GSCH_SELECT}
              value={form.city_id}
              onChange={(e) => setForm((f) => ({ ...f, city_id: e.target.value }))}
            >
              <option value="">City (optional)</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.country}
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
              type="datetime-local"
              className={GSCH_FIELD}
              value={form.starts_at}
              onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
            />
            <input
              type="datetime-local"
              className={GSCH_FIELD}
              value={form.ends_at}
              onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
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
            <label className="flex items-center gap-2 text-sm text-content">
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(e) =>
                  setForm((f) => ({ ...f, is_published: e.target.checked }))
                }
              />
              Publish now
            </label>
          </div>
        </form>
      </GschFormModal>

      {loading ? (
        <GschSkeleton variant={mine ? 'table' : 'card'} count={mine ? 5 : 6} />
      ) : items.length === 0 ? (
        <EmptyState
          title={mine ? 'No events from your organizations' : 'No matching events'}
          description={
            mine
              ? 'Publish conferences, trade missions, workshops, or networking sessions for the hub.'
              : 'Try different dates, types, or locations — or publish your own event.'
          }
        />
      ) : !mine ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <EventCard key={item.id} event={item} />
          ))}
        </div>
      ) : (
        <GschDataTable>
          <GschTableHead>
            <GschTableHeadCell>Title</GschTableHeadCell>
            <GschTableHeadCell>Type</GschTableHeadCell>
            <GschTableHeadCell>Dates / Location</GschTableHeadCell>
            <GschTableHeadCell>Status</GschTableHeadCell>
            <GschTableHeadCell align="right">Actions</GschTableHeadCell>
          </GschTableHead>
          <GschTableBody>
            {items.map((item) => {
              const dates = formatEventDates(item.starts_at, item.ends_at)
              const location =
                [item.location_label, item.country].filter(Boolean).join(' · ') ||
                null
              const datesOrLocation = dates || location || '—'
              const typeLabel =
                GSCH_EVENT_TYPES.find((t) => t.value === item.event_type)?.label ||
                item.event_type.replace(/_/g, ' ')
              return (
                <GschTableRow
                  key={item.id}
                  onClick={() => router.push(`/global-hub/events/${item.id}`)}
                >
                  <GschTableCell className="min-w-[180px]">
                    <p className="font-semibold text-content">{item.title}</p>
                    <p className="mt-0.5 text-xs text-content-tertiary">
                      {item.organization?.name || '—'}
                    </p>
                  </GschTableCell>
                  <GschTableCell className="capitalize">{typeLabel}</GschTableCell>
                  <GschTableCell>
                    <p>{datesOrLocation}</p>
                    {dates && location ? (
                      <p className="mt-0.5 text-xs text-content-tertiary">{location}</p>
                    ) : null}
                  </GschTableCell>
                  <GschTableCell>
                    <StatusBadge
                      status={item.is_published ? 'published' : 'draft'}
                    />
                  </GschTableCell>
                  <GschTableCell align="right">
                    <GschRowActions
                      onView={() => router.push(`/global-hub/events/${item.id}`)}
                      onPublish={() => togglePublish(item)}
                      publishLabel={item.is_published ? 'Unpublish' : 'Publish'}
                      publishing={publishingId === item.id}
                      onEnquire={
                        item.is_published
                          ? () =>
                              router.push(
                                `/global-hub/events/${item.id}?register=1`
                              )
                          : undefined
                      }
                      enquireLabel="Register"
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
