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
import {
  GSCH_CLIMATE_INTEREST_TYPES,
  type GschClimateInterest,
  type GschClimateInterestType,
  type GschClimateProject,
  type GschOrganization,
  type GschPaginated,
} from '@/shared/types/gsch'

export default function ClimateProjectDetailPanel({ id }: { id: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const [item, setItem] = useState<GschClimateProject | null>(null)
  const [orgs, setOrgs] = useState<GschOrganization[]>([])
  const [interests, setInterests] = useState<GschClimateInterest[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [interestType, setInterestType] =
    useState<GschClimateInterestType>('general')
  const [message, setMessage] = useState('')
  const [orgId, setOrgId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiClient.get<GschClimateProject>(
        `/api/gsch/climate-projects/${id}`
      )
      setItem(data)
    } catch (err) {
      setItem(null)
      toast.error(err instanceof ApiError ? err.message : 'Failed to load project')
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

  const loadInterests = useCallback(async () => {
    try {
      const data = await apiClient.get<GschPaginated<GschClimateInterest>>(
        `/api/gsch/climate-projects/${id}/interest?limit=30`
      )
      setInterests(data.data || [])
    } catch {
      setInterests([])
    }
  }, [id])

  useEffect(() => {
    if (authLoading || !user) return
    load()
    loadMeta()
  }, [authLoading, user?.id, load, loadMeta])

  useEffect(() => {
    if (authLoading || !user || !item) return
    loadInterests()
  }, [authLoading, user?.id, item?.id, loadInterests])

  useEffect(() => {
    if (loading || !item || searchParams.get('interest') !== '1') return
    if (item.is_published) setShowForm(true)
    router.replace(`/global-hub/climate/${id}`, { scroll: false })
  }, [loading, item, searchParams, router, id])

  async function submitInterest(e: React.FormEvent) {
    e.preventDefault()
    if (!item) return
    setBusy(true)
    try {
      await apiClient.post(`/api/gsch/climate-projects/${item.id}/interest`, {
        interest_type: interestType,
        message: message || null,
        organization_id: orgId || null,
      })
      toast.success('Interest submitted')
      setMessage('')
      setShowForm(false)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Submission failed')
    } finally {
      setBusy(false)
    }
  }

  async function updateInterest(
    interestId: string,
    action: 'under_review' | 'respond' | 'close'
  ) {
    setBusy(true)
    try {
      await apiClient.patch(`/api/gsch/climate-interest/${interestId}`, { action })
      toast.success('Interest updated')
      await loadInterests()
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
  if (!item) return <EmptyState title="Climate project not found" />

  const location = [item.location_label, item.country, item.continent]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="space-y-6">
      <GschDetailHeader
        backHref="/global-hub/climate"
        backLabel="Back to climate"
        title={item.title}
        badges={<StatusBadge status={item.is_published ? 'published' : 'draft'} />}
        subtitle={
          <span className="capitalize">
            {item.climate_type.replace(/_/g, ' ')}
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
          {item.estimated_impact ? (
            <div>
              <dt className="text-content-tertiary">Estimated impact</dt>
              <dd className="text-content">{item.estimated_impact}</dd>
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
        {item.seeking_partners?.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {item.seeking_partners.map((partner) => (
              <span key={partner} className={GSCH_CHIP}>
                Seeking: {partner}
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
        open={showForm && Boolean(item.is_published)}
        title="Express interest"
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
              form="gsch-climate-interest"
              className="btn-primary text-sm"
              disabled={busy}
            >
              {busy ? 'Submitting…' : 'Express interest'}
            </button>
          </>
        }
      >
        <form id="gsch-climate-interest" onSubmit={submitInterest} className="space-y-3">
          <select
            className={`${GSCH_SELECT} w-full`}
            value={interestType}
            onChange={(e) =>
              setInterestType(e.target.value as GschClimateInterestType)
            }
          >
            {GSCH_CLIMATE_INTEREST_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {orgs.length > 0 ? (
            <select
              className={`${GSCH_SELECT} w-full`}
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
            >
              <option value="">Personal interest</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          ) : null}
          <textarea
            className={GSCH_FIELD}
            rows={3}
            placeholder="Message (optional)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </form>
      </GschFormModal>

      {interests.length > 0 ? (
        <section className={GSCH_CARD}>
          <h3 className={GSCH_SECTION_TITLE}>Interest expressions</h3>
          <ul className="mt-3 space-y-3">
            {interests.map((interest) => (
              <li
                key={interest.id}
                className="rounded-xl border border-border/60 p-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="capitalize text-content-secondary">
                      {interest.interest_type.replace(/_/g, ' ')}
                    </p>
                    <div className="mt-1">
                      <StatusBadge status={interest.status} />
                    </div>
                  </div>
                  {interest.organization?.name ? (
                    <p className="text-xs text-content-tertiary">
                      {interest.organization.name}
                    </p>
                  ) : null}
                </div>
                {interest.message ? (
                  <p className="mt-2 text-content-secondary">{interest.message}</p>
                ) : null}
                {isOpenRecordStatus(interest.status) ? (
                  <GschRecordActions>
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      disabled={busy}
                      onClick={() => updateInterest(interest.id, 'under_review')}
                    >
                      Review
                    </button>
                    <button
                      type="button"
                      className="btn-primary text-xs"
                      disabled={busy}
                      onClick={() => updateInterest(interest.id, 'respond')}
                    >
                      Respond
                    </button>
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      disabled={busy}
                      onClick={() => updateInterest(interest.id, 'close')}
                    >
                      Close
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
