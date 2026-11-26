'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import EmptyState from '@/features/gsch/components/EmptyState'
import GschFormModal from '@/features/gsch/components/GschFormModal'
import GschSectionHeader from '@/features/gsch/components/GschSectionHeader'
import GschSkeleton from '@/features/gsch/components/GschSkeleton'
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
import {
  GSCH_CARD,
  GSCH_COUNT_BADGE,
  GSCH_FIELD,
  GSCH_LABEL,
  GSCH_MUTED,
} from '@/features/gsch/constants/styles'
import type { GschOrganization, GschVerification } from '@/shared/types/gsch'

const VERIFICATION_FLOW = [
  { key: 'draft', label: 'Prepare' },
  { key: 'submitted', label: 'Submit' },
  { key: 'under_review', label: 'Review' },
  { key: 'verified', label: 'Verified' },
] as const

function verificationFlowIndex(status: string | undefined): number {
  switch (status) {
    case 'verified':
      return 3
    case 'under_review':
    case 'submitted':
      return 2
    case 'additional_info_required':
    case 'rejected':
      return 1
    default:
      return 0
  }
}

function VerificationProgress({ status }: { status: string | undefined }) {
  const active = verificationFlowIndex(status)
  return (
    <ol className="flex flex-wrap gap-2 sm:gap-0">
      {VERIFICATION_FLOW.map((step, index) => {
        const done = index < active
        const current = index === active
        return (
          <li
            key={step.key}
            className="flex min-w-0 flex-1 items-center gap-2 sm:gap-0"
          >
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center sm:px-1">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  done
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : current
                      ? 'bg-primary/15 text-primary ring-2 ring-primary/25'
                      : 'bg-surface-secondary text-content-tertiary'
                }`}
                aria-current={current ? 'step' : undefined}
              >
                {done ? '✓' : index + 1}
              </span>
              <span
                className={`max-w-[5.5rem] text-xs font-medium ${
                  current ? 'text-content' : 'text-content-secondary'
                }`}
              >
                {step.label}
              </span>
            </div>
            {index < VERIFICATION_FLOW.length - 1 ? (
              <div className="hidden h-px min-w-[0.5rem] flex-1 bg-border sm:block" aria-hidden />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

export default function VerificationPanel() {
  const { user, loading: authLoading } = useAuth()
  const [orgs, setOrgs] = useState<GschOrganization[]>([])
  const [items, setItems] = useState<GschVerification[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [organizationId, setOrganizationId] = useState('')
  const [notes, setNotes] = useState('')
  const [documentUrls, setDocumentUrls] = useState('')

  const selectedOrg = orgs.find((o) => o.id === organizationId)
  const progressStatus = selectedOrg?.verification_status

  const load = useCallback(async () => {
    const [orgData, verData] = await Promise.all([
      apiClient.get<GschOrganization[]>('/api/gsch/organizations'),
      apiClient.get<GschVerification[]>('/api/gsch/verifications'),
    ])
    const orgList = Array.isArray(orgData) ? orgData : []
    setOrgs(orgList)
    setItems(Array.isArray(verData) ? verData : [])
    if (!organizationId && orgList[0]?.id) setOrganizationId(orgList[0].id)
  }, [organizationId])

  useEffect(() => {
    if (authLoading || !user) return
    ;(async () => {
      setLoading(true)
      try {
        await load()
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Failed to load verification data')
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id])

  async function submit(submitNow: boolean) {
    if (!organizationId) {
      toast.error('Select an organization')
      return
    }
    setBusy(true)
    try {
      await apiClient.post('/api/gsch/verifications', {
        organization_id: organizationId,
        notes: notes.trim() || null,
        document_urls: documentUrls
          .split(/[\n,]/)
          .map((s) => s.trim())
          .filter(Boolean),
        submit: submitNow,
      })
      toast.success(
        submitNow
          ? 'Verification submitted for human review'
          : 'Verification draft saved'
      )
      setNotes('')
      setDocumentUrls('')
      setShowForm(false)
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to save verification')
    } finally {
      setBusy(false)
    }
  }

  async function resubmit(id: string) {
    setBusy(true)
    try {
      await apiClient.patch(`/api/gsch/verifications/${id}`, { submit: true })
      toast.success('Verification resubmitted')
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to resubmit')
    } finally {
      setBusy(false)
    }
  }

  if (authLoading) {
    return <GschSkeleton variant="table" />
  }

  if (!user) {
    return (
      <EmptyState
        title="Sign in required"
        description="Sign in to submit organization verification requests for admin review."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className={`${GSCH_CARD} space-y-4 border-amber-500/20 bg-amber-500/5`}>
        <p className={GSCH_MUTED}>
          Verification is reviewed by CribsTalk platform admins. Organizations are never
          auto-verified — including municipalities. Upload supporting documents and wait for
          a human decision.
        </p>
        {orgs.length > 0 ? (
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-content-tertiary">
              Verification progress
              {selectedOrg ? (
                <span className="normal-case text-content-secondary">
                  {' '}
                  — {selectedOrg.name}
                </span>
              ) : null}
            </p>
            <VerificationProgress status={progressStatus} />
          </div>
        ) : null}
      </div>

      {orgs.length === 0 && !loading ? (
        <EmptyState
          title="Create an organization first"
          description="Add an organization profile, then return here to upload documents for verification."
        />
      ) : null}

      <GschFormModal
        open={showForm && orgs.length > 0}
        title="Submit verification"
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
              type="button"
              className="btn-secondary text-sm"
              disabled={busy}
              onClick={() => submit(false)}
            >
              Save draft
            </button>
            <button
              type="button"
              className="btn-primary text-sm"
              disabled={busy}
              onClick={() => submit(true)}
            >
              Submit for review
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label htmlFor="gsch-ver-org" className={GSCH_LABEL}>
              Organization
            </label>
            <select
              id="gsch-ver-org"
              className={GSCH_FIELD}
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
            >
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name} ({org.verification_status.replace(/_/g, ' ')})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="gsch-ver-docs" className={GSCH_LABEL}>
              Document URLs (one per line)
            </label>
            <textarea
              id="gsch-ver-docs"
              className={`${GSCH_FIELD} min-h-[88px]`}
              value={documentUrls}
              onChange={(e) => setDocumentUrls(e.target.value)}
              placeholder="https://… (upload to Bunny gsch-docs folder first)"
            />
          </div>
          <div>
            <label htmlFor="gsch-ver-notes" className={GSCH_LABEL}>
              Notes for reviewers
            </label>
            <textarea
              id="gsch-ver-notes"
              className={`${GSCH_FIELD} min-h-[72px]`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
      </GschFormModal>

      <section>
        <GschSectionHeader
          title="Your verification requests"
          badge={
            !loading && items.length > 0 ? (
              <span className={GSCH_COUNT_BADGE}>{items.length}</span>
            ) : null
          }
        >
          {orgs.length > 0 ? (
            <button
              type="button"
              className="btn-primary text-sm"
              data-tour="gsch-primary-cta"
              onClick={() => setShowForm(true)}
            >
              Submit verification
            </button>
          ) : null}
        </GschSectionHeader>
        {loading ? (
          <GschSkeleton variant="table" count={4} />
        ) : items.length === 0 ? (
          <EmptyState
            title="No verification requests yet"
            description="Start a verification request when your organization is ready to share supporting documents."
          />
        ) : (
          <GschDataTable>
            <GschTableHead>
              <GschTableHeadCell>Organization</GschTableHeadCell>
              <GschTableHeadCell>Updated</GschTableHeadCell>
              <GschTableHeadCell>Admin notes</GschTableHeadCell>
              <GschTableHeadCell>Status</GschTableHeadCell>
              <GschTableHeadCell align="right">Actions</GschTableHeadCell>
            </GschTableHead>
            <GschTableBody>
              {items.map((item) => {
                const canSubmit = ['draft', 'additional_info_required'].includes(
                  item.status
                )
                return (
                  <GschTableRow key={item.id}>
                    <GschTableCell className="min-w-[160px]">
                      <p className="font-semibold text-content">
                        {item.organization?.name || 'Organization'}
                      </p>
                    </GschTableCell>
                    <GschTableCell>
                      {new Date(item.updated_at).toLocaleString()}
                    </GschTableCell>
                    <GschTableCell className="max-w-[240px]">
                      <p className="line-clamp-2 text-sm text-content-secondary">
                        {item.admin_notes || '—'}
                      </p>
                    </GschTableCell>
                    <GschTableCell>
                      <StatusBadge status={item.status} />
                    </GschTableCell>
                    <GschTableCell align="right">
                      {canSubmit ? (
                        <GschRowActions
                          onEdit={() => resubmit(item.id)}
                          editLabel={busy ? '…' : 'Submit'}
                        />
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
  )
}
