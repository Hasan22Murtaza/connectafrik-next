'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import EmptyState from '@/features/gsch/components/EmptyState'
import GschFormModal from '@/features/gsch/components/GschFormModal'
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

type Tab = 'requests' | 'active'

function typeLabel(type: string) {
  return (
    GSCH_PARTNERSHIP_TYPES.find((t) => t.value === type)?.label ||
    type.replace(/_/g, ' ')
  )
}

export default function PartnershipsPanel() {
  const { user, loading: authLoading } = useAuth()
  const searchParams = useSearchParams()
  const targetCityPrefill = searchParams?.get('target_city') || ''
  const targetOrgPrefill = searchParams?.get('target_org') || ''

  const [tab, setTab] = useState<Tab>('requests')
  const [showCreate, setShowCreate] = useState(
    Boolean(targetCityPrefill || targetOrgPrefill)
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
      setShowCreate(false)
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="btn-primary text-sm"
          data-tour="gsch-primary-cta"
          onClick={() => setShowCreate(true)}
        >
          New request
        </button>
        <div className="flex flex-wrap gap-2" data-tour="gsch-tabs">
          {(
            [
              ['requests', 'Requests'],
              ['active', 'Active partnerships'],
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
      </div>

      {tab === 'requests' ? (
        <div className="space-y-8">
          <section>
            <h2 className={`${GSCH_SECTION_TITLE} mb-3`}>Received</h2>
            {received.length === 0 ? (
              <EmptyState title="No inbound requests" />
            ) : (
              <GschDataTable>
                <GschTableHead>
                  <GschTableHeadCell>Title</GschTableHeadCell>
                  <GschTableHeadCell>From</GschTableHeadCell>
                  <GschTableHeadCell>Type</GschTableHeadCell>
                  <GschTableHeadCell>Status</GschTableHeadCell>
                  <GschTableHeadCell align="right">Actions</GschTableHeadCell>
                </GschTableHead>
                <GschTableBody>
                  {received.map((r) => {
                    const from =
                      r.requesting_organization?.name ||
                      r.requesting_city?.name ||
                      '—'
                    const canRespond = r.status === 'pending'
                    return (
                      <GschTableRow key={r.id}>
                        <GschTableCell className="min-w-[160px]">
                          <p className="font-semibold text-content">{r.title}</p>
                        </GschTableCell>
                        <GschTableCell>{from}</GschTableCell>
                        <GschTableCell className="capitalize">
                          {typeLabel(r.partnership_type)}
                        </GschTableCell>
                        <GschTableCell>
                          <StatusBadge status={r.status} />
                        </GschTableCell>
                        <GschTableCell align="right">
                          {canRespond ? (
                            <div className="flex flex-wrap items-center justify-end gap-1.5">
                              <button
                                type="button"
                                className="btn-primary text-xs"
                                disabled={busyId === r.id}
                                onClick={() => act(r.id, 'accept')}
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                className="btn-secondary text-xs"
                                disabled={busyId === r.id}
                                onClick={() => act(r.id, 'decline')}
                              >
                                Decline
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-content-tertiary">—</span>
                          )}
                        </GschTableCell>
                      </GschTableRow>
                    )
                  })}
                </GschTableBody>
              </GschDataTable>
            )}
          </section>

          <section>
            <h2 className={`${GSCH_SECTION_TITLE} mb-3`}>Sent</h2>
            {sent.length === 0 ? (
              <EmptyState title="No sent requests" />
            ) : (
              <GschDataTable>
                <GschTableHead>
                  <GschTableHeadCell>Title</GschTableHeadCell>
                  <GschTableHeadCell>Target</GschTableHeadCell>
                  <GschTableHeadCell>Type</GschTableHeadCell>
                  <GschTableHeadCell>Status</GschTableHeadCell>
                  <GschTableHeadCell align="right">Actions</GschTableHeadCell>
                </GschTableHead>
                <GschTableBody>
                  {sent.map((r) => {
                    const target =
                      r.target_organization?.name ||
                      r.target_city?.name ||
                      '—'
                    const canWithdraw =
                      r.status === 'pending' || r.status === 'draft'
                    return (
                      <GschTableRow key={r.id}>
                        <GschTableCell className="min-w-[160px]">
                          <p className="font-semibold text-content">{r.title}</p>
                        </GschTableCell>
                        <GschTableCell>{target}</GschTableCell>
                        <GschTableCell className="capitalize">
                          {typeLabel(r.partnership_type)}
                        </GschTableCell>
                        <GschTableCell>
                          <StatusBadge status={r.status} />
                        </GschTableCell>
                        <GschTableCell align="right">
                          {canWithdraw ? (
                            <button
                              type="button"
                              className="btn-secondary text-xs"
                              disabled={busyId === r.id}
                              onClick={() => act(r.id, 'withdraw')}
                            >
                              Withdraw
                            </button>
                          ) : (
                            <span className="text-xs text-content-tertiary">—</span>
                          )}
                        </GschTableCell>
                      </GschTableRow>
                    )
                  })}
                </GschTableBody>
              </GschDataTable>
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
                onClick={() => setShowCreate(true)}
              >
                Create request
              </button>
            }
          />
        ) : (
          <GschDataTable>
            <GschTableHead>
              <GschTableHeadCell>Title</GschTableHeadCell>
              <GschTableHeadCell>Partners</GschTableHeadCell>
              <GschTableHeadCell>Type</GschTableHeadCell>
              <GschTableHeadCell>Status</GschTableHeadCell>
              <GschTableHeadCell align="right">Actions</GschTableHeadCell>
            </GschTableHead>
            <GschTableBody>
              {partnerships.map((p) => {
                const partners =
                  [p.organization_a?.name, p.organization_b?.name]
                    .filter(Boolean)
                    .join(' ↔ ') || '—'
                return (
                  <GschTableRow key={p.id}>
                    <GschTableCell className="min-w-[160px]">
                      <p className="font-semibold text-content">{p.title}</p>
                      {p.objectives ? (
                        <p className="mt-0.5 line-clamp-1 text-xs text-content-tertiary">
                          {p.objectives}
                        </p>
                      ) : null}
                    </GschTableCell>
                    <GschTableCell>{partners}</GschTableCell>
                    <GschTableCell className="capitalize">
                      {typeLabel(p.partnership_type)}
                    </GschTableCell>
                    <GschTableCell>
                      <StatusBadge status={p.status} />
                    </GschTableCell>
                    <GschTableCell align="right">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
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
                              onClick={() =>
                                updatePartnershipStatus(p.id, 'completed')
                              }
                            >
                              Complete
                            </button>
                            <button
                              type="button"
                              className="btn-secondary text-xs"
                              disabled={busyId === p.id}
                              onClick={() =>
                                updatePartnershipStatus(p.id, 'cancelled')
                              }
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-content-tertiary">—</span>
                        )}
                      </div>
                    </GschTableCell>
                  </GschTableRow>
                )
              })}
            </GschTableBody>
          </GschDataTable>
        )
      ) : null}

      <GschFormModal
        open={showCreate}
        title="New partnership request"
        onClose={() => setShowCreate(false)}
        footer={
          orgs.length === 0 ? (
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => setShowCreate(false)}
            >
              Close
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn-secondary text-sm"
                disabled={submitting}
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="gsch-partnership-create"
                className="btn-primary text-sm"
                disabled={submitting}
              >
                {submitting ? 'Sending…' : 'Send request'}
              </button>
            </>
          )
        }
      >
        {orgs.length === 0 ? (
          <EmptyState
            title="Join or create an organization first"
            description="You need organization representative access to send partnership requests."
          />
        ) : (
          <form
            id="gsch-partnership-create"
            onSubmit={createRequest}
            className="space-y-4"
          >
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
          </form>
        )}
      </GschFormModal>
    </div>
  )
}
