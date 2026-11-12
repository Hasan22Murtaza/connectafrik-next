'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import { useConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import YouthShell from '@/features/youth-leadership/components/YouthShell'
import StatusBadge from '@/features/youth-leadership/components/StatusBadge'
import EmptyState from '@/features/youth-leadership/components/EmptyState'
import SafetyReportButton from '@/features/youth-leadership/components/SafetyReportButton'
import VerifiedBadge from '@/features/youth-leadership/components/VerifiedBadge'
import YouthAvatar from '@/features/youth-leadership/components/YouthAvatar'
import YouthFormModal, {
  YOUTH_FIELD,
  YouthFieldLabel,
} from '@/features/youth-leadership/components/YouthFormModal'
import { YOUTH_CARD, YOUTH_CHIP } from '@/features/youth-leadership/constants/nav'
import type {
  YouthApplicationQuestion,
  YouthProgram,
  YouthProgramApplication,
} from '@/shared/types/youthLeadership'

const WITHDRAWABLE = new Set([
  'draft',
  'submitted',
  'under_review',
  'waitlisted',
])

export default function YouthProgramDetailPage() {
  const params = useParams()
  const id = String(params?.id || '')
  const { user, loading: authLoading } = useAuth()
  const { confirm, dialog } = useConfirmDialog()
  const [program, setProgram] = useState<YouthProgram | null>(null)
  const [loading, setLoading] = useState(true)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [showApplyModal, setShowApplyModal] = useState(false)

  const questions: YouthApplicationQuestion[] = useMemo(() => {
    return Array.isArray(program?.application_questions)
      ? program!.application_questions
      : []
  }, [program])

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await apiClient.get<YouthProgram>(
        `/api/youth-leadership/programs/${id}`
      )
      setProgram(data)
      const existing = (data.my_application?.application_data || {}) as Record<
        string,
        unknown
      >
      const next: Record<string, string> = {}
      for (const q of data.application_questions || []) {
        next[q.id] = String(existing[q.id] ?? '')
      }
      setAnswers(next)
    } catch (err) {
      setProgram(null)
      toast.error(err instanceof ApiError ? err.message : 'Failed to load program')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (authLoading || !user || !id) return
    load()
  }, [authLoading, user, id, load])

  async function apply(submit: boolean) {
    if (!program) return
    setSubmitting(true)
    try {
      const application = await apiClient.post<YouthProgramApplication>(
        `/api/youth-leadership/programs/${program.id}/applications`,
        {
          application_data: answers,
          submit,
        }
      )
      toast.success(submit ? 'Application submitted' : 'Draft saved')
      setShowApplyModal(false)
      setProgram((prev) => (prev ? { ...prev, my_application: application } : prev))
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to submit application')
    } finally {
      setSubmitting(false)
    }
  }

  async function withdraw() {
    if (!program?.my_application) return
    const ok = await confirm({
      title: 'Withdraw application?',
      message: 'You can re-apply later if the program is still open.',
      confirmLabel: 'Withdraw',
      variant: 'danger',
    })
    if (!ok) return
    setSubmitting(true)
    try {
      const updated = await apiClient.patch<YouthProgramApplication>(
        `/api/youth-leadership/applications/${program.my_application.id}`,
        { status: 'withdrawn' }
      )
      toast.success('Application withdrawn')
      setProgram((prev) => (prev ? { ...prev, my_application: updated } : prev))
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to withdraw')
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading || loading) {
    return (
      <YouthShell title="Program">
        <div className={`${YOUTH_CARD} h-64 animate-pulse bg-surface-secondary/70`} />
        {dialog}
      </YouthShell>
    )
  }

  if (!user) {
    return (
      <YouthShell title="Program">
        <EmptyState title="Sign in required" description="Sign in to view this program." />
        {dialog}
      </YouthShell>
    )
  }

  if (!program) {
    return (
      <YouthShell title="Program">
        <EmptyState
          title="Program not found"
          description="This program may have been removed or is no longer available."
          action={
            <Link href="/youth-leadership" className="btn-primary">
              Back to discover
            </Link>
          }
        />
        {dialog}
      </YouthShell>
    )
  }

  const application = program.my_application
  const enrollment = program.my_enrollment
  const canApply =
    program.status === 'published' &&
    (!application || ['draft', 'withdrawn'].includes(application.status))
  const canWithdraw = application && WITHDRAWABLE.has(application.status)
  const verified = program.organization?.verification_status === 'verified'
  const fillPct =
    program.capacity != null && program.capacity > 0
      ? Math.min(100, Math.round((program.seats_taken / program.capacity) * 100))
      : null

  return (
    <YouthShell
      title={program.title}
      subtitle={
        <span className="inline-flex flex-wrap items-center gap-2">
          <YouthAvatar
            src={program.organization?.logo_url}
            name={program.organization?.name || 'Organization'}
            size="sm"
          />
          <span>{program.organization?.name || 'Youth Leadership program'}</span>
          {verified ? <VerifiedBadge label="Verified organization" /> : null}
        </span>
      }
      actions={
        <div className="flex flex-wrap gap-2">
          {canApply ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => setShowApplyModal(true)}
            >
              {application?.status === 'draft' ? 'Continue application' : 'Apply now'}
            </button>
          ) : null}
          <SafetyReportButton
            context={{
              program_id: program.id,
              organization_id: program.organization_id,
            }}
          />
        </div>
      }
    >
      {dialog}

      <YouthFormModal
        open={showApplyModal}
        title="Apply to program"
        onClose={() => {
          if (!submitting) setShowApplyModal(false)
        }}
        footer={
          <>
            <button
              type="button"
              className="btn-secondary"
              disabled={submitting}
              onClick={() => setShowApplyModal(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={submitting}
              onClick={() => apply(false)}
            >
              Save draft
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={submitting}
              onClick={() => apply(true)}
            >
              {submitting ? 'Submitting…' : 'Submit application'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {program.requires_guardian_approval ? (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-3 text-sm text-amber-900 dark:text-amber-100">
              This program requires guardian approval after you submit.
            </div>
          ) : null}
          {questions.map((q) => (
            <div key={q.id}>
              <YouthFieldLabel hint={q.required ? 'Required' : 'Optional'}>
                {q.prompt}
              </YouthFieldLabel>
              <textarea
                className={`${YOUTH_FIELD} min-h-[96px]`}
                maxLength={q.maxLength || 2000}
                value={answers[q.id] || ''}
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                }
              />
            </div>
          ))}
          {questions.length === 0 ? (
            <p className="text-sm text-content-secondary">
              No additional questions for this program. You can submit directly.
            </p>
          ) : null}
        </div>
      </YouthFormModal>

      <div className="grid gap-6 lg:grid-cols-[1.45fr_1fr]">
        <section className={YOUTH_CARD}>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={program.status} />
            {enrollment ? <StatusBadge status={enrollment.status} /> : null}
            {program.requires_guardian_approval ? (
              <span className={YOUTH_CHIP}>Guardian approval required</span>
            ) : null}
          </div>

          {program.description ? (
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-content-secondary">
              {program.description}
            </p>
          ) : null}

          {program.objectives ? (
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-content">Objectives</h3>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-content-secondary">
                {program.objectives}
              </p>
            </div>
          ) : null}

          {program.eligibility ? (
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-content">Eligibility</h3>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-content-secondary">
                {program.eligibility}
              </p>
            </div>
          ) : null}

          {program.requirements ? (
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-content">Requirements</h3>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-content-secondary">
                {program.requirements}
              </p>
            </div>
          ) : null}

          {program.safety_information ? (
            <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
              <h3 className="text-sm font-semibold text-content">Safety information</h3>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-content-secondary">
                {program.safety_information}
              </p>
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-border bg-surface-secondary/50 px-4 py-3">
              <h3 className="text-sm font-semibold text-content">Safety</h3>
              <p className="mt-1.5 text-sm text-content-secondary">
                Use Report if anything feels unsafe. Mentors and organizations are subject to
                CribsSafe verification and community standards.
              </p>
            </div>
          )}

          <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-xl bg-surface-secondary/50 px-3 py-3">
              <dt className="text-xs text-content-tertiary">Format</dt>
              <dd className="mt-1 capitalize text-content">
                {program.format.replace(/_/g, ' ')}
              </dd>
            </div>
            <div className="rounded-xl bg-surface-secondary/50 px-3 py-3">
              <dt className="text-xs text-content-tertiary">Location</dt>
              <dd className="mt-1 text-content">
                {[program.location_region, program.country].filter(Boolean).join(', ') ||
                  '—'}
              </dd>
            </div>
            <div className="rounded-xl bg-surface-secondary/50 px-3 py-3">
              <dt className="text-xs text-content-tertiary">Age range</dt>
              <dd className="mt-1 text-content">
                {program.minimum_age ?? '—'}–{program.maximum_age ?? '—'}
              </dd>
            </div>
            <div className="rounded-xl bg-surface-secondary/50 px-3 py-3">
              <dt className="text-xs text-content-tertiary">Deadline</dt>
              <dd className="mt-1 text-content">
                {program.application_deadline
                  ? new Date(program.application_deadline).toLocaleDateString()
                  : '—'}
              </dd>
            </div>
            <div className="rounded-xl bg-surface-secondary/50 px-3 py-3">
              <dt className="text-xs text-content-tertiary">Schedule</dt>
              <dd className="mt-1 text-content">{program.schedule || '—'}</dd>
            </div>
            <div className="rounded-xl bg-surface-secondary/50 px-3 py-3">
              <dt className="text-xs text-content-tertiary">Seats</dt>
              <dd className="mt-1 text-content">
                {program.capacity == null
                  ? `${program.seats_taken} enrolled`
                  : `${program.seats_taken} / ${program.capacity}`}
              </dd>
            </div>
          </dl>

          {fillPct != null ? (
            <div className="mt-5">
              <div className="mb-1.5 flex justify-between text-xs text-content-secondary">
                <span>Cohort seat allocation</span>
                <span className="tabular-nums">{fillPct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-secondary">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${fillPct}%` }}
                />
              </div>
            </div>
          ) : null}

          {program.required_skills?.length ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {program.required_skills.map((skill) => (
                <span key={skill} className={YOUTH_CHIP}>
                  {skill}
                </span>
              ))}
            </div>
          ) : null}
        </section>

        <aside className="space-y-4">
          {application ? (
            <div className={YOUTH_CARD}>
              <h3 className="text-sm font-semibold text-content">Your application</h3>
              <div className="mt-2">
                <StatusBadge status={application.status} />
              </div>
              {application.guardian_approval_status &&
              application.guardian_approval_status !== 'not_required' ? (
                <p className="mt-3 text-xs leading-relaxed text-content-secondary">
                  Guardian approval:{' '}
                  <span className="capitalize font-medium text-content">
                    {application.guardian_approval_status.replace(/_/g, ' ')}
                  </span>
                </p>
              ) : null}
              {application.submitted_at ? (
                <p className="mt-2 text-xs text-content-tertiary">
                  Submitted {new Date(application.submitted_at).toLocaleString()}
                </p>
              ) : null}
              {canWithdraw ? (
                <button
                  type="button"
                  className="btn-secondary mt-4 w-full"
                  disabled={submitting}
                  onClick={withdraw}
                >
                  Withdraw application
                </button>
              ) : null}
              <Link
                href="/youth-leadership?tab=applications"
                className="mt-3 block text-center text-sm font-medium text-primary"
              >
                View all applications
              </Link>
            </div>
          ) : null}

          {enrollment ? (
            <div className={YOUTH_CARD}>
              <h3 className="text-sm font-semibold text-content">Enrollment</h3>
              <div className="mt-2">
                <StatusBadge status={enrollment.status} />
              </div>
              <Link
                href="/youth-leadership?tab=enrolled"
                className="mt-3 block text-sm font-medium text-primary"
              >
                Go to My Programs
              </Link>
            </div>
          ) : null}

          {canApply ? (
            <div className={YOUTH_CARD}>
              <h3 className="text-sm font-semibold text-content">Ready to apply?</h3>
              <p className="mt-1 text-sm leading-relaxed text-content-secondary">
                Open the application form to answer a few questions and submit.
              </p>
              <button
                type="button"
                className="btn-primary mt-4 w-full"
                onClick={() => setShowApplyModal(true)}
              >
                {application?.status === 'draft' ? 'Continue application' : 'Apply now'}
              </button>
            </div>
          ) : null}

          <div className={YOUTH_CARD}>
            <h3 className="text-sm font-semibold text-content">Need help?</h3>
            <p className="mt-1 text-sm text-content-secondary">
              Report unsafe behavior or suspicious contact at any time.
            </p>
            <div className="mt-3">
              <SafetyReportButton
                className="btn-secondary w-full text-sm"
                context={{
                  program_id: program.id,
                  organization_id: program.organization_id,
                }}
              />
            </div>
          </div>
        </aside>
      </div>
    </YouthShell>
  )
}
