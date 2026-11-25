'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import EmptyState from '@/features/gsch/components/EmptyState'
import GschDetailHeader from '@/features/gsch/components/GschDetailHeader'
import GschFormModal from '@/features/gsch/components/GschFormModal'
import StatusBadge from '@/features/gsch/components/StatusBadge'
import {
  GSCH_CARD,
  GSCH_FIELD,
  GSCH_MUTED,
  GSCH_SECTION_TITLE,
  GSCH_SELECT,
} from '@/features/gsch/constants/styles'
import {
  GSCH_AGREEMENT_DISCLAIMER,
  GSCH_AGREEMENT_MILESTONE_STATUSES,
  type GschAgreement,
  type GschAgreementApproval,
  type GschAgreementApprovalAction,
  type GschAgreementMilestone,
  type GschAgreementMilestoneStatus,
  type GschAgreementStatus,
  type GschOrganization,
} from '@/shared/types/gsch'

const NEXT_STATUS: Partial<Record<GschAgreementStatus, GschAgreementStatus[]>> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['discussion', 'approved', 'cancelled'],
  discussion: ['approved', 'submitted', 'cancelled'],
  approved: ['signed', 'discussion', 'cancelled'],
  signed: ['active', 'cancelled'],
  active: ['completed', 'cancelled'],
}

export default function AgreementDetailPanel({ id }: { id: string }) {
  const { user, loading: authLoading } = useAuth()
  const [agreement, setAgreement] = useState<GschAgreement | null>(null)
  const [milestones, setMilestones] = useState<GschAgreementMilestone[]>([])
  const [approvals, setApprovals] = useState<GschAgreementApproval[]>([])
  const [orgs, setOrgs] = useState<GschOrganization[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [disclaimerAck, setDisclaimerAck] = useState(false)
  const [approvalOrgId, setApprovalOrgId] = useState('')
  const [approvalNotes, setApprovalNotes] = useState('')
  const [showMilestoneForm, setShowMilestoneForm] = useState(false)
  const [milestoneTitle, setMilestoneTitle] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [agr, miles, apps, orgRes] = await Promise.all([
        apiClient.get<GschAgreement>(`/api/gsch/agreements/${id}`),
        apiClient.get<{ data: GschAgreementMilestone[] }>(
          `/api/gsch/agreements/${id}/milestones`
        ),
        apiClient.get<{ data: GschAgreementApproval[] }>(
          `/api/gsch/agreements/${id}/approvals`
        ),
        apiClient.get<GschOrganization[]>('/api/gsch/organizations'),
      ])
      setAgreement(agr)
      setMilestones(miles.data || [])
      setApprovals(apps.data || [])
      setOrgs(orgRes || [])
      const partyOrg =
        (orgRes || []).find(
          (o) => o.id === agr.organization_a_id || o.id === agr.organization_b_id
        )?.id || ''
      setApprovalOrgId((cur) => cur || partyOrg)
    } catch (err) {
      setAgreement(null)
      toast.error(err instanceof ApiError ? err.message : 'Failed to load agreement')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (authLoading || !user) return
    load()
  }, [authLoading, user?.id, load])

  async function transition(status: GschAgreementStatus) {
    if (status === 'signed' && !disclaimerAck) {
      toast.error('Acknowledge the disclaimer before recording signed intent')
      return
    }
    setBusy(true)
    try {
      await apiClient.patch(`/api/gsch/agreements/${id}`, {
        status,
        disclaimer_acknowledged: status === 'signed' ? true : undefined,
      })
      toast.success(`Status → ${status.replace(/_/g, ' ')}`)
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  async function postApproval(action: GschAgreementApprovalAction) {
    if (!approvalOrgId) {
      toast.error('Select your organization')
      return
    }
    if (action === 'signed_intent' && !disclaimerAck) {
      toast.error('Acknowledge the disclaimer before recording signature intent')
      return
    }
    setBusy(true)
    try {
      await apiClient.post(`/api/gsch/agreements/${id}/approvals`, {
        organization_id: approvalOrgId,
        action,
        notes: approvalNotes || null,
        disclaimer_acknowledged: action === 'signed_intent' ? true : undefined,
      })
      toast.success(
        action === 'signed_intent'
          ? 'Signature intent recorded (not legally binding)'
          : `Recorded: ${action}`
      )
      setApprovalNotes('')
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  async function addMilestone(e: React.FormEvent) {
    e.preventDefault()
    if (!milestoneTitle.trim()) return
    setBusy(true)
    try {
      await apiClient.post(`/api/gsch/agreements/${id}/milestones`, {
        title: milestoneTitle,
      })
      setMilestoneTitle('')
      setShowMilestoneForm(false)
      toast.success('Milestone added')
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to add milestone')
    } finally {
      setBusy(false)
    }
  }

  async function updateMilestone(
    milestoneId: string,
    status: GschAgreementMilestoneStatus
  ) {
    setBusy(true)
    try {
      await apiClient.patch(`/api/gsch/agreements/${id}/milestones/${milestoneId}`, {
        status,
      })
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Milestone update failed')
    } finally {
      setBusy(false)
    }
  }

  if (authLoading || loading) {
    return <div className={`${GSCH_CARD} h-48 animate-pulse`} />
  }
  if (!user) return <EmptyState title="Sign in required" />
  if (!agreement) {
    return (
      <EmptyState
        title="Agreement not found"
        action={
          <Link href="/global-hub/agreements" className="btn-primary text-sm">
            Back to agreements
          </Link>
        }
      />
    )
  }

  const next = NEXT_STATUS[agreement.status] || []

  return (
    <div className="space-y-6">
      <GschDetailHeader
        backHref="/global-hub/agreements"
        backLabel="Back to agreements"
        title={agreement.title}
        badges={<StatusBadge status={agreement.status} />}
        subtitle={
          <span className="capitalize">
            {agreement.template_type.replace(/_/g, ' ')}
          </span>
        }
        meta={`${agreement.organization_a?.name || 'Org A'} ↔ ${agreement.organization_b?.name || 'Org B'}`}
      />

      {agreement.objectives ? (
        <section className={GSCH_CARD}>
          <h3 className={GSCH_SECTION_TITLE}>Objectives</h3>
          <p className="mt-2 text-sm leading-relaxed text-content-secondary">
            {agreement.objectives}
          </p>
        </section>
      ) : null}

      {(agreement.responsibilities_a || agreement.responsibilities_b) && (
        <section className={GSCH_CARD}>
          <h3 className={GSCH_SECTION_TITLE}>Responsibilities</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-surface-secondary/60 p-3 text-sm">
              <p className="font-medium text-content">
                {agreement.organization_a?.name || 'Org A'}
              </p>
              <p className="mt-1 text-content-secondary">
                {agreement.responsibilities_a || '—'}
              </p>
            </div>
            <div className="rounded-xl bg-surface-secondary/60 p-3 text-sm">
              <p className="font-medium text-content">
                {agreement.organization_b?.name || 'Org B'}
              </p>
              <p className="mt-1 text-content-secondary">
                {agreement.responsibilities_b || '—'}
              </p>
            </div>
          </div>
        </section>
      )}

      <section className={`${GSCH_CARD} border-amber-500/20 bg-amber-500/5`}>
        <p className={`${GSCH_MUTED}`}>{GSCH_AGREEMENT_DISCLAIMER}</p>
        <label className="mt-3 flex items-start gap-2 text-sm text-content">
          <input
            type="checkbox"
            className="mt-1"
            checked={disclaimerAck}
            onChange={(e) => setDisclaimerAck(e.target.checked)}
          />
          <span>
            I understand this checkbox records intent only and is not a legally binding
            electronic signature.
          </span>
        </label>
      </section>

      {next.length > 0 ? (
        <section className={GSCH_CARD}>
          <h3 className={GSCH_SECTION_TITLE}>Workflow</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {next.map((status) => (
              <button
                key={status}
                type="button"
                className="btn-secondary text-sm capitalize"
                disabled={busy || (status === 'signed' && !disclaimerAck)}
                onClick={() => transition(status)}
              >
                Move to {status.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className={GSCH_CARD}>
        <h3 className={GSCH_SECTION_TITLE}>Record action</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <select
            className={GSCH_SELECT}
            value={approvalOrgId}
            onChange={(e) => setApprovalOrgId(e.target.value)}
          >
            <option value="">Your organization…</option>
            {orgs
              .filter(
                (o) =>
                  o.id === agreement.organization_a_id ||
                  o.id === agreement.organization_b_id
              )
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
          </select>
          <input
            className={GSCH_FIELD}
            placeholder="Notes (optional)"
            value={approvalNotes}
            onChange={(e) => setApprovalNotes(e.target.value)}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              'submitted',
              'approved',
              'rejected',
              'comment',
              'signed_intent',
            ] as GschAgreementApprovalAction[]
          ).map((action) => (
            <button
              key={action}
              type="button"
              className="btn-secondary text-xs capitalize"
              disabled={busy || (action === 'signed_intent' && !disclaimerAck)}
              onClick={() => postApproval(action)}
            >
              {action.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </section>

      <section className={GSCH_CARD}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className={GSCH_SECTION_TITLE}>Milestones</h3>
          <button
            type="button"
            className="btn-primary text-sm"
            onClick={() => setShowMilestoneForm(true)}
          >
            Add milestone
          </button>
        </div>
        <ul className="mt-4 space-y-2">
          {milestones.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-secondary/50 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-content">{m.title}</p>
                <StatusBadge status={m.status} />
              </div>
              <select
                className={GSCH_SELECT}
                value={m.status}
                disabled={busy}
                onChange={(e) =>
                  updateMilestone(
                    m.id,
                    e.target.value as GschAgreementMilestoneStatus
                  )
                }
              >
                {GSCH_AGREEMENT_MILESTONE_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </li>
          ))}
          {milestones.length === 0 ? (
            <li className="text-sm text-content-tertiary">No milestones yet.</li>
          ) : null}
        </ul>
      </section>

      <GschFormModal
        open={showMilestoneForm}
        title="Add milestone"
        onClose={() => setShowMilestoneForm(false)}
        size="md"
        footer={
          <>
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={busy}
              onClick={() => setShowMilestoneForm(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="gsch-agreement-milestone"
              className="btn-primary text-sm"
              disabled={busy}
            >
              {busy ? 'Adding…' : 'Add'}
            </button>
          </>
        }
      >
        <form id="gsch-agreement-milestone" className="space-y-3" onSubmit={addMilestone}>
          <input
            className={GSCH_FIELD}
            placeholder="New milestone title"
            value={milestoneTitle}
            onChange={(e) => setMilestoneTitle(e.target.value)}
            autoFocus
          />
        </form>
      </GschFormModal>

      <section className={GSCH_CARD}>
        <h3 className={GSCH_SECTION_TITLE}>Approval history</h3>
        <ul className="mt-3 space-y-2">
          {approvals.map((a) => (
            <li key={a.id} className="rounded-xl bg-surface-secondary/50 px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={a.action} />
                <span className="text-content-secondary">
                  {a.organization?.name || a.organization_id}
                </span>
                <span className="text-xs text-content-tertiary">
                  {new Date(a.created_at).toLocaleString()}
                </span>
              </div>
              {a.notes ? (
                <p className="mt-1 text-content-secondary">{a.notes}</p>
              ) : null}
            </li>
          ))}
          {approvals.length === 0 ? (
            <li className="text-sm text-content-tertiary">No actions yet.</li>
          ) : null}
        </ul>
      </section>
    </div>
  )
}
