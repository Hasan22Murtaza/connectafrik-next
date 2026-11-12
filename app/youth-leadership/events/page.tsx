'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import YouthShell from '@/features/youth-leadership/components/YouthShell'
import StatusBadge from '@/features/youth-leadership/components/StatusBadge'
import EmptyState from '@/features/youth-leadership/components/EmptyState'
import YouthFormModal, {
  YOUTH_FIELD,
  YouthFieldLabel,
} from '@/features/youth-leadership/components/YouthFormModal'
import { YOUTH_CARD } from '@/features/youth-leadership/constants/nav'
import type {
  YouthEvent,
  YouthEventType,
  YouthOrganization,
} from '@/shared/types/youthLeadership'

type OrgRow = YouthOrganization & { my_role?: string | null }

const EVENT_TYPES: YouthEventType[] = [
  'workshop',
  'webinar',
  'leadership_session',
  'mentorship_session',
  'community_event',
  'training',
]

export default function YouthEventsPage() {
  const { user, loading: authLoading } = useAuth()
  const [events, setEvents] = useState<YouthEvent[]>([])
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [eventType, setEventType] = useState('')
  const [form, setForm] = useState({
    organization_id: '',
    title: '',
    description: '',
    event_type: 'workshop' as YouthEventType,
    start_at: '',
    end_at: '',
    format: 'online',
    location_region: '',
    access_info: '',
    capacity: '',
  })

  const coordinatorOrgs = orgs.filter(
    (o) => o.my_role === 'admin' || o.my_role === 'coordinator'
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [eventList, orgList] = await Promise.all([
        apiClient.get<YouthEvent[]>('/api/youth-leadership/events', {
          upcoming: 1,
          event_type: eventType || undefined,
        }),
        apiClient.get<OrgRow[]>('/api/youth-leadership/organizations'),
      ])
      setEvents(Array.isArray(eventList) ? eventList : [])
      const nextOrgs = Array.isArray(orgList) ? orgList : []
      setOrgs(nextOrgs)
      setForm((f) => {
        if (f.organization_id) return f
        const firstCoord = nextOrgs.find(
          (o) => o.my_role === 'admin' || o.my_role === 'coordinator'
        )
        return firstCoord ? { ...f, organization_id: firstCoord.id } : f
      })
    } catch (err) {
      setEvents([])
      toast.error(err instanceof ApiError ? err.message : 'Failed to load events')
    } finally {
      setLoading(false)
    }
  }, [eventType])

  useEffect(() => {
    if (authLoading || !user) return
    load()
  }, [authLoading, user, load])

  async function register(eventId: string, action: 'register' | 'cancel') {
    setBusy(true)
    try {
      await apiClient.post(`/api/youth-leadership/events/${eventId}/attend`, { action })
      toast.success(action === 'register' ? 'Registered' : 'Registration cancelled')
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update registration')
    } finally {
      setBusy(false)
    }
  }

  async function createEvent() {
    if (!form.organization_id || !form.title.trim() || !form.start_at) {
      toast.error('Organization, title, and start time are required')
      return
    }
    setBusy(true)
    try {
      await apiClient.post('/api/youth-leadership/events', {
        organization_id: form.organization_id,
        title: form.title.trim(),
        description: form.description || null,
        event_type: form.event_type,
        start_at: new Date(form.start_at).toISOString(),
        end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
        format: form.format,
        location_region: form.location_region || null,
        access_info: form.access_info || null,
        capacity: form.capacity ? Number(form.capacity) : null,
        status: 'scheduled',
      })
      toast.success('Event created')
      setShowCreate(false)
      setForm((f) => ({
        ...f,
        title: '',
        description: '',
        start_at: '',
        end_at: '',
        location_region: '',
        access_info: '',
        capacity: '',
      }))
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create event')
    } finally {
      setBusy(false)
    }
  }

  function closeCreate() {
    if (busy) return
    setShowCreate(false)
  }

  return (
    <YouthShell
      title="Events & Workshops"
      subtitle="Register for upcoming sessions or publish events for your organization."
      actions={
        coordinatorOrgs.length > 0 ? (
          <button type="button" className="btn-primary" onClick={() => setShowCreate(true)}>
            Create event
          </button>
        ) : null
      }
    >
      {authLoading || loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`${YOUTH_CARD} h-24 animate-pulse bg-surface-secondary`} />
          ))}
        </div>
      ) : !user ? (
        <EmptyState title="Sign in required" />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <select
              className="rounded-lg border border-border bg-surface-primary px-3 py-2 text-sm"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
            >
              <option value="">All types</option>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          {events.length === 0 ? (
            <EmptyState
              title="No upcoming events"
              description="Scheduled workshops and sessions will show up here."
            />
          ) : (
            <ul className="space-y-3">
              {events.map((event) => {
                const registered =
                  event.my_attendance &&
                  ['registered', 'attended'].includes(event.my_attendance.attendance_status)
                return (
                  <li key={event.id} className={YOUTH_CARD}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-content-primary">{event.title}</h3>
                          <StatusBadge status={event.status} />
                        </div>
                        <p className="mt-1 text-xs capitalize text-content-tertiary">
                          {event.event_type.replace(/_/g, ' ')} ·{' '}
                          {event.format.replace(/_/g, ' ')}
                        </p>
                        <p className="mt-1 text-sm text-content-secondary">
                          {new Date(event.start_at).toLocaleString()}
                          {event.end_at
                            ? ` – ${new Date(event.end_at).toLocaleString()}`
                            : ''}
                        </p>
                        {event.description ? (
                          <p className="mt-2 line-clamp-2 text-sm text-content-secondary">
                            {event.description}
                          </p>
                        ) : null}
                        <p className="mt-2 text-xs text-content-tertiary">
                          {event.attendance_count ?? 0} registered
                          {event.capacity != null ? ` / ${event.capacity}` : ''}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {registered ? (
                          <button
                            type="button"
                            className="btn-secondary"
                            disabled={busy}
                            onClick={() => register(event.id, 'cancel')}
                          >
                            Cancel registration
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-primary"
                            disabled={busy}
                            onClick={() => register(event.id, 'register')}
                          >
                            Register
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      <YouthFormModal
        open={showCreate && coordinatorOrgs.length > 0}
        title="Create event"
        description="Publish a workshop or session for your organization."
        onClose={closeCreate}
        footer={
          <>
            <button type="button" className="btn-secondary" disabled={busy} onClick={closeCreate}>
              Cancel
            </button>
            <button type="button" className="btn-primary" disabled={busy} onClick={createEvent}>
              {busy ? 'Publishing…' : 'Publish event'}
            </button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <YouthFieldLabel htmlFor="event-org">Organization</YouthFieldLabel>
            <select
              id="event-org"
              className={YOUTH_FIELD}
              value={form.organization_id}
              onChange={(e) => setForm((f) => ({ ...f, organization_id: e.target.value }))}
              required
            >
              {coordinatorOrgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <YouthFieldLabel htmlFor="event-type">Type</YouthFieldLabel>
            <select
              id="event-type"
              className={YOUTH_FIELD}
              value={form.event_type}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  event_type: e.target.value as YouthEventType,
                }))
              }
            >
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <YouthFieldLabel htmlFor="event-title">Title</YouthFieldLabel>
            <input
              id="event-title"
              className={YOUTH_FIELD}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <YouthFieldLabel htmlFor="event-description">Description</YouthFieldLabel>
            <textarea
              id="event-description"
              className={`${YOUTH_FIELD} min-h-[72px]`}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div>
            <YouthFieldLabel htmlFor="event-start">Starts</YouthFieldLabel>
            <input
              id="event-start"
              className={YOUTH_FIELD}
              type="datetime-local"
              value={form.start_at}
              onChange={(e) => setForm((f) => ({ ...f, start_at: e.target.value }))}
              required
            />
          </div>
          <div>
            <YouthFieldLabel htmlFor="event-end">Ends</YouthFieldLabel>
            <input
              id="event-end"
              className={YOUTH_FIELD}
              type="datetime-local"
              value={form.end_at}
              onChange={(e) => setForm((f) => ({ ...f, end_at: e.target.value }))}
            />
          </div>
          <div>
            <YouthFieldLabel htmlFor="event-format">Format</YouthFieldLabel>
            <select
              id="event-format"
              className={YOUTH_FIELD}
              value={form.format}
              onChange={(e) => setForm((f) => ({ ...f, format: e.target.value }))}
            >
              <option value="online">Online</option>
              <option value="in_person">In person</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>
          <div>
            <YouthFieldLabel htmlFor="event-capacity">Capacity</YouthFieldLabel>
            <input
              id="event-capacity"
              className={YOUTH_FIELD}
              type="number"
              min={1}
              value={form.capacity}
              onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
            />
          </div>
          <div>
            <YouthFieldLabel htmlFor="event-region">Region / venue</YouthFieldLabel>
            <input
              id="event-region"
              className={YOUTH_FIELD}
              value={form.location_region}
              onChange={(e) => setForm((f) => ({ ...f, location_region: e.target.value }))}
            />
          </div>
          <div>
            <YouthFieldLabel htmlFor="event-access">Access info</YouthFieldLabel>
            <input
              id="event-access"
              className={YOUTH_FIELD}
              value={form.access_info}
              onChange={(e) => setForm((f) => ({ ...f, access_info: e.target.value }))}
              placeholder="Meeting link or check-in notes"
            />
          </div>
        </div>
      </YouthFormModal>
    </YouthShell>
  )
}
