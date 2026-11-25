'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import EmptyState from '@/features/gsch/components/EmptyState'
import GschDetailHeader from '@/features/gsch/components/GschDetailHeader'
import GschFormModal from '@/features/gsch/components/GschFormModal'
import GschRecordActions from '@/features/gsch/components/GschRecordActions'
import StatusBadge from '@/features/gsch/components/StatusBadge'
import {
  GSCH_CARD,
  GSCH_CHIP,
  GSCH_FIELD,
  GSCH_MUTED,
  GSCH_SECTION_TITLE,
  GSCH_SELECT,
} from '@/features/gsch/constants/styles'
import {
  GSCH_INVESTMENT_DISCLAIMER,
  type GschOrganization,
  type GschPaginated,
  type GschProject,
  type GschProjectApplication,
  type GschProjectApplicationType,
} from '@/shared/types/gsch'

export default function ProjectDetailPanel({ id }: { id: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const [item, setItem] = useState<GschProject | null>(null)
  const [orgs, setOrgs] = useState<GschOrganization[]>([])
  const [applications, setApplications] = useState<GschProjectApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [appType, setAppType] = useState<GschProjectApplicationType>('express_interest')
  const [appMessage, setAppMessage] = useState('')
  const [appOrgId, setAppOrgId] = useState('')
  const [appEmail, setAppEmail] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiClient.get<GschProject>(`/api/gsch/projects/${id}`)
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
      setAppOrgId(orgRes?.[0]?.id || '')
    } catch {
      /* optional */
    }
  }, [])

  const loadApplications = useCallback(async () => {
    try {
      const data = await apiClient.get<GschPaginated<GschProjectApplication>>(
        `/api/gsch/projects/${id}/applications?limit=30`
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
    if (loading || !item || searchParams.get('interest') !== '1') return
    if (item.is_published) setShowForm(true)
    router.replace(`/global-hub/investment/${id}`, { scroll: false })
  }, [loading, item, searchParams, router, id])

  async function submitApplication(e: React.FormEvent) {
    e.preventDefault()
    if (!item) return
    setBusy(true)
    try {
      await apiClient.post(`/api/gsch/projects/${item.id}/applications`, {
        application_type: appType,
        message: appMessage || null,
        organization_id: appOrgId || null,
        contact_email: appEmail || null,
      })
      toast.success(
        appType === 'express_interest' ? 'Interest submitted' : 'Information requested'
      )
      setAppMessage('')
      setShowForm(false)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Submission failed')
    } finally {
      setBusy(false)
    }
  }

  async function updateApplication(
    applicationId: string,
    action: 'respond' | 'under_review' | 'close'
  ) {
    setBusy(true)
    try {
      await apiClient.patch(`/api/gsch/project-applications/${applicationId}`, {
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
  if (!item) return <EmptyState title="Project not found" />

  const location = [item.location_label, item.country, item.continent]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="space-y-6">
      <GschDetailHeader
        backHref="/global-hub/investment"
        backLabel="Back to investment"
        title={item.title}
        badges={
          <>
            <StatusBadge status={item.project_stage} />
            <StatusBadge status={item.verification_status} />
            <StatusBadge status={item.is_published ? 'published' : 'draft'} />
          </>
        }
        subtitle={
          <span className="capitalize">
            {item.category.replace(/_/g, ' ')}
            {item.organization?.name ? ` · ${item.organization.name}` : ''}
          </span>
        }
        meta={location || undefined}
      />

      <section className={`${GSCH_CARD} border-amber-500/20 bg-amber-500/5`}>
        <p className={GSCH_MUTED}>{GSCH_INVESTMENT_DISCLAIMER}</p>
      </section>

      {item.description ? (
        <section className={GSCH_CARD}>
          <h3 className={GSCH_SECTION_TITLE}>Description</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-content-secondary">
            {item.description}
          </p>
        </section>
      ) : null}

      <section className={GSCH_CARD}>
        <h3 className={GSCH_SECTION_TITLE}>Key info</h3>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-content-tertiary">Estimated value</dt>
            <dd className="text-content">
              {item.estimated_value_amount != null
                ? `${item.estimated_value_currency || 'USD'} ${item.estimated_value_amount}`
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-content-tertiary">Funding required</dt>
            <dd className="text-content">
              {item.funding_required_amount != null
                ? `${item.funding_required_currency || 'USD'} ${item.funding_required_amount}`
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-content-tertiary">Structure</dt>
            <dd className="text-content">{item.investment_structure || '—'}</dd>
          </div>
          <div>
            <dt className="text-content-tertiary">Contact</dt>
            <dd className="text-content">
              {[item.contact_name, item.contact_email].filter(Boolean).join(' · ') ||
                '—'}
            </dd>
          </div>
        </dl>
        {item.required_partners?.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {item.required_partners.map((p) => (
              <span key={p} className={GSCH_CHIP}>
                {p}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <GschFormModal
        open={showForm && Boolean(item.is_published)}
        title="Express interest / request info"
        description="This connects you with the project owners. No payment or commitment is made here."
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
              form="gsch-project-application"
              className="btn-primary text-sm"
              disabled={busy}
            >
              Submit
            </button>
          </>
        }
      >
        <form id="gsch-project-application" onSubmit={submitApplication} className="space-y-3">
          <select
            className={`${GSCH_SELECT} w-full`}
            value={appType}
            onChange={(e) =>
              setAppType(e.target.value as GschProjectApplicationType)
            }
          >
            <option value="express_interest">Express interest</option>
            <option value="request_information">Request information</option>
          </select>
          {orgs.length > 0 ? (
            <select
              className={`${GSCH_SELECT} w-full`}
              value={appOrgId}
              onChange={(e) => setAppOrgId(e.target.value)}
            >
              <option value="">Personal (no org)</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          ) : null}
          <input
            className={GSCH_FIELD}
            placeholder="Contact email (optional)"
            value={appEmail}
            onChange={(e) => setAppEmail(e.target.value)}
          />
          <textarea
            className={GSCH_FIELD}
            rows={3}
            placeholder="Message"
            value={appMessage}
            onChange={(e) => setAppMessage(e.target.value)}
          />
        </form>
      </GschFormModal>

      {applications.length > 0 ? (
        <section>
          <h3 className={`${GSCH_SECTION_TITLE} mb-3`}>Applications received</h3>
          <ul className="space-y-2">
            {applications.map((app) => (
              <li key={app.id} className={GSCH_CARD}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium capitalize text-content">
                      {app.application_type.replace(/_/g, ' ')}
                      {app.organization?.name ? ` · ${app.organization.name}` : ''}
                    </p>
                    {app.message ? (
                      <p className="mt-1 text-sm text-content-secondary">{app.message}</p>
                    ) : null}
                    {app.contact_email ? (
                      <p className="mt-1 text-xs text-content-tertiary">
                        {app.contact_email}
                      </p>
                    ) : null}
                  </div>
                  <StatusBadge status={app.status} />
                </div>
                {['submitted', 'under_review'].includes(app.status) ? (
                  <GschRecordActions>
                    <button
                      type="button"
                      className="btn-secondary text-sm"
                      disabled={busy}
                      onClick={() => updateApplication(app.id, 'under_review')}
                    >
                      Mark reviewing
                    </button>
                    <button
                      type="button"
                      className="btn-primary text-sm"
                      disabled={busy}
                      onClick={() => updateApplication(app.id, 'respond')}
                    >
                      Mark responded
                    </button>
                    <button
                      type="button"
                      className="btn-secondary text-sm"
                      disabled={busy}
                      onClick={() => updateApplication(app.id, 'close')}
                    >
                      Close
                    </button>
                  </GschRecordActions>
                ) : null}              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
