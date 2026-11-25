'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import EmptyState from '@/features/gsch/components/EmptyState'
import GschDetailHeader from '@/features/gsch/components/GschDetailHeader'
import GschFormModal from '@/features/gsch/components/GschFormModal'
import GschRecordActions, {
  isOpenRecordStatus,
} from '@/features/gsch/components/GschRecordActions'
import StatusBadge from '@/features/gsch/components/StatusBadge'
import {
  GSCH_CARD,
  GSCH_CHIP,
  GSCH_FIELD,
  GSCH_SECTION_TITLE,
  GSCH_SELECT,
} from '@/features/gsch/constants/styles'
import type {
  GschOrganization,
  GschPaginated,
  GschTourismInitiative,
  GschTourismPartnershipRequest,
} from '@/shared/types/gsch'

export default function TourismInitiativeDetailPanel({ id }: { id: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const [item, setItem] = useState<GschTourismInitiative | null>(null)
  const [orgs, setOrgs] = useState<GschOrganization[]>([])
  const [requests, setRequests] = useState<GschTourismPartnershipRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [message, setMessage] = useState('')
  const [orgId, setOrgId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiClient.get<GschTourismInitiative>(
        `/api/gsch/tourism-initiatives/${id}`
      )
      setItem(data)
    } catch (err) {
      setItem(null)
      toast.error(err instanceof ApiError ? err.message : 'Failed to load initiative')
    } finally {
      setLoading(false)
    }
  }, [id])

  const loadMeta = useCallback(async () => {
    try {
      const orgRes = await apiClient.get<GschOrganization[]>(
        '/api/gsch/organizations?mine=1'
      )
      setOrgs(orgRes || [])
      setOrgId(orgRes?.[0]?.id || '')
    } catch {
      /* optional */
    }
  }, [])

  const loadRequests = useCallback(async () => {
    try {
      const data = await apiClient.get<GschPaginated<GschTourismPartnershipRequest>>(
        `/api/gsch/tourism-initiatives/${id}/requests?limit=30`
      )
      setRequests(data.data || [])
    } catch {
      setRequests([])
    }
  }, [id])

  useEffect(() => {
    if (authLoading || !user) return
    load()
    loadMeta()
  }, [authLoading, user?.id, load, loadMeta])

  useEffect(() => {
    if (authLoading || !user || !item) return
    loadRequests()
  }, [authLoading, user?.id, item?.id, loadRequests])

  useEffect(() => {
    if (loading || !item || searchParams.get('request') !== '1') return
    if (item.is_published && orgs.length > 0) setShowForm(true)
    router.replace(`/global-hub/tourism/${id}`, { scroll: false })
  }, [loading, item, orgs, searchParams, router, id])

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault()
    if (!item) return
    if (!orgId) {
      toast.error('Select an organization to request partnership')
      return
    }
    if (!message.trim()) {
      toast.error('Message is required')
      return
    }
    setBusy(true)
    try {
      await apiClient.post(`/api/gsch/tourism-initiatives/${item.id}/requests`, {
        from_organization_id: orgId,
        message,
      })
      toast.success('Partnership request submitted')
      setMessage('')
      setShowForm(false)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Submission failed')
    } finally {
      setBusy(false)
    }
  }

  async function updateRequest(
    requestId: string,
    action: 'under_review' | 'accept' | 'decline'
  ) {
    setBusy(true)
    try {
      await apiClient.patch(`/api/gsch/tourism-requests/${requestId}`, { action })
      toast.success('Request updated')
      await loadRequests()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  if (authLoading || loading) {
    return <div className={`${GSCH_CARD} h-48 animate-pulse`} />
  }
  if (!user) return <EmptyState title="Sign in required" />
  if (!item) return <EmptyState title="Tourism initiative not found" />

  const location = [item.location_label, item.country, item.continent]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="space-y-6">
      <GschDetailHeader
        backHref="/global-hub/tourism"
        backLabel="Back to tourism"
        title={item.title}
        badges={<StatusBadge status={item.is_published ? 'published' : 'draft'} />}
        subtitle={
          <span className="capitalize">
            {item.tourism_type.replace(/_/g, ' ')}
            {item.organization?.name ? ` · ${item.organization.name}` : ''}
          </span>
        }
        meta={location || undefined}
      />

      {item.summary ? (
        <section className={GSCH_CARD}>
          <h3 className={GSCH_SECTION_TITLE}>Summary</h3>
          <p className="mt-2 text-sm leading-relaxed text-content-secondary">
            {item.summary}
          </p>
        </section>
      ) : null}

      {item.description ? (
        <section className={GSCH_CARD}>
          <h3 className={GSCH_SECTION_TITLE}>Details</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-content-secondary">
            {item.description}
          </p>
        </section>
      ) : null}

      <section className={GSCH_CARD}>
        <h3 className={GSCH_SECTION_TITLE}>Key info</h3>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          {item.season_label ? (
            <div>
              <dt className="text-content-tertiary">Season</dt>
              <dd className="text-content">{item.season_label}</dd>
            </div>
          ) : null}
          {item.contact_email ? (
            <div>
              <dt className="text-content-tertiary">Contact</dt>
              <dd>
                <a
                  href={`mailto:${item.contact_email}`}
                  className="text-primary hover:underline"
                >
                  {item.contact_email}
                </a>
              </dd>
            </div>
          ) : null}
          {item.external_url ? (
            <div>
              <dt className="text-content-tertiary">External link</dt>
              <dd>
                <a
                  href={item.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Open link
                </a>
              </dd>
            </div>
          ) : null}
        </dl>
        {item.partnership_needs?.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {item.partnership_needs.map((need) => (
              <span key={need} className={GSCH_CHIP}>
                {need}
              </span>
            ))}
          </div>
        ) : null}
        {item.tags?.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <span key={tag} className={GSCH_CHIP}>
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <GschFormModal
        open={showForm && Boolean(item.is_published) && orgs.length > 0}
        title="Request partnership"
        onClose={() => setShowForm(false)}
        footer={
          <>
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={busy}
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="gsch-tourism-request"
              className="btn-primary text-sm"
              disabled={busy}
            >
              {busy ? 'Submitting…' : 'Send request'}
            </button>
          </>
        }
      >
        <form id="gsch-tourism-request" onSubmit={submitRequest} className="space-y-3">
          <select
            className={`${GSCH_SELECT} w-full`}
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            required
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <textarea
            className={GSCH_FIELD}
            rows={3}
            placeholder="Partnership message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
          />
        </form>
      </GschFormModal>

      {requests.length > 0 ? (
        <section className={GSCH_CARD}>
          <h3 className={GSCH_SECTION_TITLE}>Partnership requests</h3>
          <ul className="mt-3 space-y-3">
            {requests.map((req) => (
              <li
                key={req.id}
                className="rounded-xl border border-border/60 p-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <StatusBadge status={req.status} />
                  {req.from_organization?.name ? (
                    <p className="text-xs text-content-tertiary">
                      {req.from_organization.name}
                    </p>
                  ) : null}
                </div>
                <p className="mt-2 text-content-secondary">{req.message}</p>
                {isOpenRecordStatus(req.status) ? (
                  <GschRecordActions>
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      disabled={busy}
                      onClick={() => updateRequest(req.id, 'under_review')}
                    >
                      Review
                    </button>
                    <button
                      type="button"
                      className="btn-primary text-xs"
                      disabled={busy}
                      onClick={() => updateRequest(req.id, 'accept')}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      disabled={busy}
                      onClick={() => updateRequest(req.id, 'decline')}
                    >
                      Decline
                    </button>
                  </GschRecordActions>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
