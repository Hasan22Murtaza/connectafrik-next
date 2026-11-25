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
  GschEducationApplication,
  GschEducationProgram,
  GschOrganization,
  GschPaginated,
} from '@/shared/types/gsch'

export default function EducationProgramDetailPanel({ id }: { id: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const [item, setItem] = useState<GschEducationProgram | null>(null)
  const [orgs, setOrgs] = useState<GschOrganization[]>([])
  const [applications, setApplications] = useState<GschEducationApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [message, setMessage] = useState('')
  const [orgId, setOrgId] = useState('')
  const [email, setEmail] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiClient.get<GschEducationProgram>(
        `/api/gsch/education-programs/${id}`
      )
      setItem(data)
    } catch (err) {
      setItem(null)
      toast.error(err instanceof ApiError ? err.message : 'Failed to load program')
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

  const loadApplications = useCallback(async () => {
    try {
      const data = await apiClient.get<GschPaginated<GschEducationApplication>>(
        `/api/gsch/education-programs/${id}/applications?limit=30`
      )
      setApplications(data.data || [])
    } catch {
      setApplications([])
    }
  }, [id])

  useEffect(() => {
    if (authLoading || !user) return
    load()
    loadMeta()
  }, [authLoading, user?.id, load, loadMeta])

  useEffect(() => {
    if (authLoading || !user || !item) return
    loadApplications()
  }, [authLoading, user?.id, item?.id, loadApplications])

  useEffect(() => {
    if (loading || !item || searchParams.get('apply') !== '1') return
    if (item.is_published) setShowForm(true)
    router.replace(`/global-hub/education/${id}`, { scroll: false })
  }, [loading, item, searchParams, router, id])

  async function submitApplication(e: React.FormEvent) {
    e.preventDefault()
    if (!item) return
    setBusy(true)
    try {
      await apiClient.post(`/api/gsch/education-programs/${item.id}/applications`, {
        message: message || null,
        organization_id: orgId || null,
        contact_email: email || null,
      })
      toast.success('Application submitted')
      setMessage('')
      setShowForm(false)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Submission failed')
    } finally {
      setBusy(false)
    }
  }

  async function updateApplication(
    applicationId: string,
    action: 'under_review' | 'accept' | 'decline'
  ) {
    setBusy(true)
    try {
      await apiClient.patch(`/api/gsch/education-applications/${applicationId}`, {
        action,
      })
      toast.success('Application updated')
      await loadApplications()
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
  if (!item) return <EmptyState title="Education program not found" />

  const location = [item.location_label, item.country, item.continent]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="space-y-6">
      <GschDetailHeader
        backHref="/global-hub/education"
        backLabel="Back to education"
        title={item.title}
        badges={<StatusBadge status={item.is_published ? 'published' : 'draft'} />}
        subtitle={
          <span className="capitalize">
            {item.program_type.replace(/_/g, ' ')}
            {item.organization?.name ? ` · ${item.organization.name}` : ''}
          </span>
        }
        meta={[item.institution_name, location].filter(Boolean).join(' · ') || undefined}
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
          {item.eligibility ? (
            <div>
              <dt className="text-content-tertiary">Eligibility</dt>
              <dd className="text-content">{item.eligibility}</dd>
            </div>
          ) : null}
          {item.duration_label ? (
            <div>
              <dt className="text-content-tertiary">Duration</dt>
              <dd className="text-content">{item.duration_label}</dd>
            </div>
          ) : null}
          {item.application_deadline ? (
            <div>
              <dt className="text-content-tertiary">Application deadline</dt>
              <dd className="text-content">
                {new Date(item.application_deadline).toLocaleString()}
              </dd>
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
        {item.tags?.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
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
        title="Apply"
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
              form="gsch-education-application"
              className="btn-primary text-sm"
              disabled={busy}
            >
              {busy ? 'Submitting…' : 'Submit application'}
            </button>
          </>
        }
      >
        <form
          id="gsch-education-application"
          onSubmit={submitApplication}
          className="space-y-3"
        >
          {orgs.length > 0 ? (
            <select
              className={`${GSCH_SELECT} w-full`}
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
            >
              <option value="">Personal application</option>
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
          <input
            className={GSCH_FIELD}
            placeholder="Contact email (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </form>
      </GschFormModal>

      {applications.length > 0 ? (
        <section className={GSCH_CARD}>
          <h3 className={GSCH_SECTION_TITLE}>Applications</h3>
          <ul className="mt-3 space-y-3">
            {applications.map((app) => (
              <li
                key={app.id}
                className="rounded-xl border border-border/60 p-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <StatusBadge status={app.status} />
                  {app.organization?.name ? (
                    <p className="text-xs text-content-tertiary">
                      {app.organization.name}
                    </p>
                  ) : null}
                </div>
                {app.message ? (
                  <p className="mt-2 text-content-secondary">{app.message}</p>
                ) : null}
                {isOpenRecordStatus(app.status) ? (
                  <GschRecordActions>
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      disabled={busy}
                      onClick={() => updateApplication(app.id, 'under_review')}
                    >
                      Review
                    </button>
                    <button
                      type="button"
                      className="btn-primary text-xs"
                      disabled={busy}
                      onClick={() => updateApplication(app.id, 'accept')}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      disabled={busy}
                      onClick={() => updateApplication(app.id, 'decline')}
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
