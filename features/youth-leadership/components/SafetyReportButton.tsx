'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import type { YouthSafetyReportType } from '@/shared/types/youthLeadership'
import YouthFormModal, {
  YOUTH_FIELD,
  YouthFieldLabel,
} from '@/features/youth-leadership/components/YouthFormModal'

const REPORT_TYPES: { value: YouthSafetyReportType; label: string }[] = [
  { value: 'safety', label: 'Safety concern' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'suspicious_contact', label: 'Suspicious contact' },
  { value: 'child_abuse', label: 'Child abuse' },
  { value: 'policy_violation', label: 'Policy violation' },
  { value: 'other', label: 'Other' },
]

export type SafetyReportContext = {
  reported_user_id?: string | null
  program_id?: string | null
  project_id?: string | null
  mentorship_id?: string | null
  organization_id?: string | null
}

export default function SafetyReportButton({
  context,
  label = 'Report a safety concern',
  className = 'btn-secondary text-sm',
}: {
  context?: SafetyReportContext
  label?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [reportType, setReportType] = useState<YouthSafetyReportType>('safety')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    if (!description.trim()) {
      toast.error('Please describe the concern')
      return
    }
    setSubmitting(true)
    try {
      await apiClient.post('/api/youth-leadership/safety-reports', {
        report_type: reportType,
        description: description.trim(),
        reported_user_id: context?.reported_user_id ?? null,
        program_id: context?.program_id ?? null,
        project_id: context?.project_id ?? null,
        mentorship_id: context?.mentorship_id ?? null,
        organization_id: context?.organization_id ?? null,
      })
      toast.success('Safety report submitted')
      setOpen(false)
      setDescription('')
      setReportType('safety')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to submit report')
    } finally {
      setSubmitting(false)
    }
  }

  function close() {
    if (submitting) return
    setOpen(false)
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {label}
      </button>

      <YouthFormModal
        open={open}
        title="Report a safety concern"
        description="Reports are reviewed by platform moderators. Provide clear details."
        onClose={close}
        size="md"
        footer={
          <>
            <button type="button" className="btn-secondary" disabled={submitting} onClick={close}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={submitting}
              onClick={submit}
            >
              {submitting ? 'Submitting…' : 'Submit report'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <YouthFieldLabel htmlFor="safety-report-type">Type</YouthFieldLabel>
            <select
              id="safety-report-type"
              className={YOUTH_FIELD}
              value={reportType}
              onChange={(e) => setReportType(e.target.value as YouthSafetyReportType)}
            >
              {REPORT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <YouthFieldLabel htmlFor="safety-report-description">Description</YouthFieldLabel>
            <textarea
              id="safety-report-description"
              className={`${YOUTH_FIELD} min-h-[120px]`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What happened? Include dates, people involved, and any links if relevant."
            />
          </div>
        </div>
      </YouthFormModal>
    </>
  )
}
