'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import EmptyState from '@/features/gsch/components/EmptyState'
import PartnershipRequestCard from '@/features/gsch/components/PartnershipRequestCard'
import StatusBadge from '@/features/gsch/components/StatusBadge'
import {
  GSCH_CARD,
  GSCH_FIELD,
  GSCH_SECTION_TITLE,
  GSCH_SELECT,
} from '@/features/gsch/constants/styles'
import {
  GSCH_PARTNERSHIP_TYPES,
  type GschCity,
  type GschOrganization,
  type GschPaginated,
  type GschPartnership,
  type GschPartnershipRequest,
  type GschPartnershipType,
} from '@/shared/types/gsch'

type Tab = 'requests' | 'active' | 'create'

export default function PartnershipsPanel() {
  const { user, loading: authLoading } = useAuth()
  const searchParams = useSearchParams()
  const targetCityPrefill = searchParams?.get('target_city') || ''
  const targetOrgPrefill = searchParams?.get('target_org') || ''

  const [tab, setTab] = useState<Tab>(
    targetCityPrefill || targetOrgPrefill ? 'create' : 'requests'
  )
  const [requests, setRequests] = useState<GschPartnershipRequest[]>([])
  const [partnerships, setPartnerships] = useState<GschPartnership[]>([])
  const [orgs, setOrgs] = useState<GschOrganization[]>([])
  const [cities, setCities] = useState<GschCity[]>([])
  const [publishedCities, setPublishedCities] = useState<GschCity[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    requesting_organization_id: '',
    requesting_city_id: '',
    target_city_id: targetCityPrefill,
    target_organization_id: targetOrgPrefill,
    title: '',
    partnership_type: 'sister_city' as GschPartnershipType,
    message: '',
    objectives: '',
    proposed_duration: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [reqRes, partRes, orgRes, mineCities, discover] = await Promise.all([
        apiClient.get<GschPaginated<GschPartnershipRequest>>(
          '/api/gsch/partnership-requests?limit=50'
        ),
        apiClient.get<GschPaginated<GschPartnership>>(
          '/api/gsch/partnerships?mine=1&limit=50'
        ),
        apiClient.get<GschOrganization[]>('/api/gsch/organizations?mine=1'),
        apiClient.get<GschPaginated<GschCity>>('/api/gsch/cities?mine=1&limit=50'),
        apiClient.get<GschPaginated<GschCity>>('/api/gsch/cities?limit=50'),
      ])
      setRequests(reqRes.data || [])
      setPartnerships(partRes.data || [])
      const orgList = orgRes || []
      setOrgs(orgList)
      setCities(mineCities.data || [])
      setPublishedCities(discover.data || [])
      setForm((f) => ({
        ...f,
        requesting_organization_id:
          f.requesting_organization_id || orgList[0]?.id || '',
        target_city_id: f.target_city_id || targetCityPrefill,
        target_organization_id: f.target_organization_id || targetOrgPrefill,
      }))
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load partnerships')
    } finally {
      setLoading(false)
    }
  }, [targetCityPrefill, targetOrgPrefill])

  useEffect(() => {
    if (authLoading || !user) return
    load()
  }, [authLoading, user?.id, load])

  const sent = useMemo(
    () => requests.filter((r) => r.direction === 'sent'),
    [requests]
  )
  const received = useMemo(
    () => requests.filter((r) => r.direction === 'received'),
    [requests]
  )

  async function act(id: string, action: 'accept' | 'decline' | 'withdraw') {
    setBusyId(id)
    try {
      await apiClient.patch(`/api/gsch/partnership-requests/${id}`, { action })
      toast.success(
        action === 'accept'
          ? 'Partnership accepted'
          : action === 'decline'
            ? 'Request declined'
            : 'Request withdrawn'
      )
      await load()
      if (action === 'accept') setTab('active')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  async function updatePartnershipStatus(
    id: string,
    status: 'paused' | 'completed' | 'cancelled' | 'active'
  ) {
    setBusyId(id)
    try {
      await apiClient.patch(`/api/gsch/partnerships/${id}`, { status })
      toast.success('Partnership updated')
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Update failed')
    } finally {
      setBusyId(null)
    }
  }

  async function createRequest(e: React.FormEvent) {
    e.preventDefault()
    if (!form.requesting_organization_id) {
      toast.error('Select your organization')
      return
    }
    if (!form.target_city_id && !form.target_organization_id) {
      toast.error('Select a target city or organization')
      return
    }
    if (!form.title.trim()) {
      toast.error('Title is required')
      return
    }
    setSubmitting(true)
    try {
      await apiClient.post('/api/gsch/partnership-requests', {
        ...form,
        status: 'pending',
      })
      toast.success('Partnership request sent')
      setForm((f) => ({
        ...f,
        title: '',
        message: '',
        objectives: '',
        proposed_duration: '',
        target_city_id: '',
        target_organization_id: '',
      }))
      setTab('requests')
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to send request')
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={`${GSCH_CARD} h-28 animate-pulse`} />
        ))}
      </div>
    )
  }

  if (!user) return <EmptyState title="Sign in required" />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['requests', 'Requests'],
            ['active', 'Active partnerships'],
            ['create', 'New request'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={tab === key ? 'btn-primary text-sm' : 'btn-secondary text-sm'}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'requests' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <h2 className={`${GSCH_SECTION_TITLE} mb-3`}>Received</h2>
            {received.length === 0 ? (
              <EmptyState title="No inbound requests" />
            ) : (
              <div className="space-y-3">
                {received.map((r) => (
                  <PartnershipRequestCard
                    key={r.id}
                    request={r}
                    busy={busyId === r.id}
                    onAccept={() => act(r.id, 'accept')}
                    onDecline={() => act(r.id, 'decline')}
                  />
                ))}
              </div>
            )}
          </section>
          <section>
            <h2 className={`${GSCH_SECTION_TITLE} mb-3`}>Sent</h2>
            {sent.length === 0 ? (
              <EmptyState title="No sent requests" />
            ) : (
              <div className="space-y-3">
                {sent.map((r) => (
                  <PartnershipRequestCard
                    key={r.id}
                    request={r}
                    busy={busyId === r.id}
                    onWithdraw={() => act(r.id, 'withdraw')}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}

      {tab === 'active' ? (
        partnerships.length === 0 ? (
          <EmptyState
            title="No active partnerships yet"
            description="Accept an inbound request or send a new partnership proposal."
            action={
              <button
                type="button"
                className="btn-primary text-sm"
                onClick={() => setTab('create')}
              >
                Create request
              </button>
            }
          />
        ) : (
          <ul className="space-y-3">
            {partnerships.map((p) => (
              <li key={p.id} className={GSCH_CARD}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-content">{p.title}</p>
                    <p className="mt-0.5 text-xs capitalize text-content-tertiary">
                      {p.partnership_type.replace(/_/g, ' ')} ·{' '}
                      {p.organization_a?.name} ↔ {p.organization_b?.name}
                    </p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                {p.objectives ? (
                  <p className="mt-2 text-sm text-content-secondary">{p.objectives}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.status === 'active' ? (
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      disabled={busyId === p.id}
                      onClick={() => updatePartnershipStatus(p.id, 'paused')}
                    >
                      Pause
                    </button>
                  ) : null}
                  {p.status === 'paused' ? (
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      disabled={busyId === p.id}
                      onClick={() => updatePartnershipStatus(p.id, 'active')}
                    >
                      Resume
                    </button>
                  ) : null}
                  {['active', 'paused'].includes(p.status) ? (
                    <>
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        disabled={busyId === p.id}
                        onClick={() => updatePartnershipStatus(p.id, 'completed')}
                      >
                        Complete
                      </button>
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        disabled={busyId === p.id}
                        onClick={() => updatePartnershipStatus(p.id, 'cancelled')}
                      >
                        Cancel
                      </button>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {tab === 'create' ? (
        <form onSubmit={createRequest} className={`${GSCH_CARD} space-y-4`}>
          <h2 className={GSCH_SECTION_TITLE}>New partnership request</h2>

          {orgs.length === 0 ? (
            <EmptyState
              title="Join or create an organization first"
              description="You need organization representative access to send partnership requests."
            />
          ) : (
            <>
              <label className="block text-sm">
                <span className="mb-1.5 block text-content-secondary">Your organization</span>
                <select
                  className={`${GSCH_SELECT} w-full`}
                  value={form.requesting_organization_id}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      requesting_organization_id: e.target.value,
                    }))
                  }
                  required
                >
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="mb-1.5 block text-content-secondary">
                  Your city (optional)
                </span>
                <select
                  className={`${GSCH_SELECT} w-full`}
                  value={form.requesting_city_id}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, requesting_city_id: e.target.value }))
                  }
                >
                  <option value="">None</option>
                  {cities
                    .filter((c) => c.organization_id === form.requesting_organization_id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="mb-1.5 block text-content-secondary">Target city</span>
                <select
                  className={`${GSCH_SELECT} w-full`}
                  value={form.target_city_id}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      target_city_id: e.target.value,
                      target_organization_id: e.target.value
                        ? ''
                        : f.target_organization_id,
                    }))
                  }
                >
                  <option value="">Select published city…</option>
                  {publishedCities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.country}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="mb-1.5 block text-content-secondary">
                  Or target organization ID
                </span>
                <input
                  className={GSCH_FIELD}
                  value={form.target_organization_id}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      target_organization_id: e.target.value,
                      target_city_id: e.target.value ? '' : f.target_city_id,
                    }))
                  }
                  placeholder="Organization UUID (optional if city selected)"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1.5 block text-content-secondary">Type</span>
                <select
                  className={`${GSCH_SELECT} w-full`}
                  value={form.partnership_type}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      partnership_type: e.target.value as GschPartnershipType,
                    }))
                  }
                >
                  {GSCH_PARTNERSHIP_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="mb-1.5 block text-content-secondary">Title</span>
                <input
                  className={GSCH_FIELD}
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  required
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1.5 block text-content-secondary">Message</span>
                <textarea
                  className={GSCH_FIELD}
                  rows={3}
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1.5 block text-content-secondary">Objectives</span>
                <textarea
                  className={GSCH_FIELD}
                  rows={2}
                  value={form.objectives}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, objectives: e.target.value }))
                  }
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1.5 block text-content-secondary">
                  Proposed duration
                </span>
                <input
                  className={GSCH_FIELD}
                  value={form.proposed_duration}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, proposed_duration: e.target.value }))
                  }
                  placeholder="e.g. 2 years"
                />
              </label>

              <button
                type="submit"
                className="btn-primary text-sm"
                disabled={submitting}
              >
                {submitting ? 'Sending…' : 'Send request'}
              </button>
            </>
          )}
        </form>
      ) : null}
    </div>
  )
}
