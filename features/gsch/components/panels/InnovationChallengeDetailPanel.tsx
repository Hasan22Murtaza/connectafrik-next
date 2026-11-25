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
  GschInnovationChallenge,
  GschInnovationSubmission,
  GschOrganization,
  GschPaginated,
} from '@/shared/types/gsch'

export default function InnovationChallengeDetailPanel({ id }: { id: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const [item, setItem] = useState<GschInnovationChallenge | null>(null)
  const [orgs, setOrgs] = useState<GschOrganization[]>([])
  const [submissions, setSubmissions] = useState<GschInnovationSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [proposal, setProposal] = useState('')
  const [orgId, setOrgId] = useState('')
  const [email, setEmail] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiClient.get<GschInnovationChallenge>(
        `/api/gsch/innovation-challenges/${id}`
      )
      setItem(data)
    } catch (err) {
      setItem(null)
      toast.error(err instanceof ApiError ? err.message : 'Failed to load challenge')
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

  const loadSubmissions = useCallback(async () => {
    try {
      const data = await apiClient.get<GschPaginated<GschInnovationSubmission>>(
        `/api/gsch/innovation-challenges/${id}/submissions?limit=30`
      )
      setSubmissions(data.data || [])
    } catch {
      setSubmissions([])
    }
  }, [id])

  useEffect(() => {
    if (authLoading || !user) return
    load()
    loadMeta()
  }, [authLoading, user?.id, load, loadMeta])

  useEffect(() => {
    if (authLoading || !user || !item) return
    loadSubmissions()
  }, [authLoading, user?.id, item?.id, loadSubmissions])

  useEffect(() => {
    if (loading || !item || searchParams.get('submit') !== '1') return
    if (item.is_published && item.status === 'open') setShowForm(true)
    router.replace(`/global-hub/smart-cities/${id}`, { scroll: false })
  }, [loading, item, searchParams, router, id])

  async function submitProposal(e: React.FormEvent) {
    e.preventDefault()
    if (!item) return
    if (!title.trim() || !proposal.trim()) {
      toast.error('Title and proposal are required')
      return
    }
    setBusy(true)
    try {
      await apiClient.post(`/api/gsch/innovation-challenges/${item.id}/submissions`, {
        title,
        proposal,
        organization_id: orgId || null,
        contact_email: email || null,
      })
      toast.success('Proposal submitted')
      setTitle('')
      setProposal('')
      setShowForm(false)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Submission failed')
    } finally {
      setBusy(false)
    }
  }

  async function updateSubmission(
    submissionId: string,
    action: 'under_review' | 'shortlist' | 'select' | 'decline'
  ) {
    setBusy(true)
    try {
      await apiClient.patch(`/api/gsch/innovation-submissions/${submissionId}`, {
        action,
      })
      toast.success('Submission updated')
      await loadSubmissions()
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
  if (!item) return <EmptyState title="Innovation challenge not found" />

  const location = [item.location_label, item.country, item.continent]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="space-y-6">
      <GschDetailHeader
        backHref="/global-hub/smart-cities"
        backLabel="Back to smart cities"
        title={item.title}
        badges={
          <>
            <StatusBadge status={item.status} />
            <StatusBadge status={item.is_published ? 'published' : 'draft'} />
          </>
        }
        subtitle={
          <span className="capitalize">
            {item.focus_area.replace(/_/g, ' ')}
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
          {item.prize_or_benefit ? (
            <div>
              <dt className="text-content-tertiary">Prize / benefit</dt>
              <dd className="text-content">{item.prize_or_benefit}</dd>
            </div>
          ) : null}
          {item.submission_deadline ? (
            <div>
              <dt className="text-content-tertiary">Submission deadline</dt>
              <dd className="text-content">
                {new Date(item.submission_deadline).toLocaleString()}
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
        open={showForm && Boolean(item.is_published) && item.status === 'open'}
        title="Submit proposal"
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
              form="gsch-innovation-proposal"
              className="btn-primary text-sm"
              disabled={busy}
            >
              {busy ? 'Submitting…' : 'Submit proposal'}
            </button>
          </>
        }
      >
        <form
          id="gsch-innovation-proposal"
          onSubmit={submitProposal}
          className="space-y-3"
        >
          {orgs.length > 0 ? (
            <select
              className={`${GSCH_SELECT} w-full`}
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
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
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <textarea
            className={GSCH_FIELD}
            rows={4}
            placeholder="Proposal details"
            value={proposal}
            onChange={(e) => setProposal(e.target.value)}
            required
          />
          <input
            className={GSCH_FIELD}
            placeholder="Contact email (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </form>
      </GschFormModal>

      {submissions.length > 0 ? (
        <section className={GSCH_CARD}>
          <h3 className={GSCH_SECTION_TITLE}>Submissions</h3>
          <ul className="mt-3 space-y-3">
            {submissions.map((sub) => (
              <li
                key={sub.id}
                className="rounded-xl border border-border/60 p-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-content">{sub.title}</p>
                    <div className="mt-1">
                      <StatusBadge status={sub.status} />
                    </div>
                  </div>
                  {sub.organization?.name ? (
                    <p className="text-xs text-content-tertiary">
                      {sub.organization.name}
                    </p>
                  ) : null}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-content-secondary">
                  {sub.proposal}
                </p>
                {isOpenRecordStatus(sub.status) || sub.status === 'shortlisted' ? (
                  <GschRecordActions>
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      disabled={busy}
                      onClick={() => updateSubmission(sub.id, 'under_review')}
                    >
                      Review
                    </button>
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      disabled={busy}
                      onClick={() => updateSubmission(sub.id, 'shortlist')}
                    >
                      Shortlist
                    </button>
                    <button
                      type="button"
                      className="btn-primary text-xs"
                      disabled={busy}
                      onClick={() => updateSubmission(sub.id, 'select')}
                    >
                      Select
                    </button>
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      disabled={busy}
                      onClick={() => updateSubmission(sub.id, 'decline')}
                    >
                      Decline
                    </button>
                  </GschRecordActions>
                ) : null}
              </li>
            ))}          </ul>
        </section>
      ) : null}
    </div>
  )
}
