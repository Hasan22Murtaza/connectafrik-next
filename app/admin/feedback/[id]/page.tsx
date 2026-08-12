'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  RefreshCw,
  Trash2,
  User,
} from '@/shared/icons'
import toast from 'react-hot-toast'
import { AdminErrorState } from '@/features/admin/components/AdminErrorState'
import { AdminLoading } from '@/features/admin/components/AdminLoading'
import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader'
import { AdminMotion } from '@/features/admin/components/AdminMotion'
import { useAdminAuth } from '@/features/admin/hooks/useAdminAuth'
import { AP } from '@/features/admin/constants/adminLayout'
import {
  deleteAdminFeedback,
  FEEDBACK_STATUS_OPTIONS,
  FEEDBACK_TYPE_OPTIONS,
  getAdminFeedback,
  updateAdminFeedback,
} from '@/features/feedback/services/feedbackService'
import type { FeedbackStatus, FeedbackType, FeedbackWithUser } from '@/lib/feedback/types'

function DetailRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex justify-between items-start gap-4 py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right">{value}</span>
    </div>
  )
}

function formatDate(dateString: string | null | undefined) {
  if (!dateString) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString))
}

function typeLabel(type: FeedbackType) {
  return FEEDBACK_TYPE_OPTIONS.find((o) => o.value === type)?.label || type
}

function statusLabel(status: FeedbackStatus) {
  return FEEDBACK_STATUS_OPTIONS.find((o) => o.value === status)?.label || status
}

function statusBadgeClass(status: FeedbackStatus) {
  switch (status) {
    case 'new':
      return 'bg-sky-50 text-sky-700'
    case 'under_review':
      return 'bg-amber-50 text-amber-700'
    case 'planned':
      return 'bg-violet-50 text-violet-700'
    case 'in_progress':
      return 'bg-orange-50 text-orange-700'
    case 'completed':
      return 'bg-emerald-50 text-emerald-700'
    case 'rejected':
      return 'bg-red-50 text-red-700'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

export default function AdminFeedbackDetailPage() {
  const params = useParams()
  const router = useRouter()
  const feedbackId = params?.id as string
  const { isReady, authLoading } = useAdminAuth('/admin/feedback')

  const [feedback, setFeedback] = useState<FeedbackWithUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [status, setStatus] = useState<FeedbackStatus>('new')
  const [internalNotes, setInternalNotes] = useState('')
  const [adminResponse, setAdminResponse] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const loadFeedback = useCallback(async () => {
    if (!feedbackId) return
    try {
      setLoading(true)
      setError(false)
      const data = await getAdminFeedback(feedbackId)
      setFeedback(data)
      setStatus(data.status)
      setInternalNotes(data.internal_notes || '')
      setAdminResponse(data.admin_response || '')
    } catch {
      setError(true)
      toast.error('Unable to load feedback')
    } finally {
      setLoading(false)
    }
  }, [feedbackId])

  useEffect(() => {
    if (!isReady) return
    loadFeedback()
  }, [isReady, loadFeedback])

  const handleSave = async () => {
    if (!feedbackId) return
    setSaving(true)
    try {
      const updated = await updateAdminFeedback(feedbackId, {
        status,
        internal_notes: internalNotes.trim() || null,
        admin_response: adminResponse.trim() || null,
      })
      setFeedback(updated)
      setStatus(updated.status)
      setInternalNotes(updated.internal_notes || '')
      setAdminResponse(updated.admin_response || '')
      toast.success('Feedback updated')
    } catch {
      toast.error('Failed to update feedback')
    } finally {
      setSaving(false)
    }
  }

  const handleMarkCompleted = async () => {
    if (!feedbackId) return
    setSaving(true)
    try {
      const updated = await updateAdminFeedback(feedbackId, {
        status: 'completed',
        internal_notes: internalNotes.trim() || null,
        admin_response: adminResponse.trim() || null,
      })
      setFeedback(updated)
      setStatus(updated.status)
      toast.success('Marked as completed')
    } catch {
      toast.error('Failed to update feedback')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!feedbackId) return
    if (!window.confirm('Delete this feedback permanently? This cannot be undone.')) return
    setDeleting(true)
    try {
      await deleteAdminFeedback(feedbackId)
      toast.success('Feedback deleted')
      router.push('/admin/feedback')
    } catch {
      toast.error('Failed to delete feedback')
      setDeleting(false)
    }
  }

  if (authLoading || !isReady || loading) {
    return <AdminLoading variant="user-detail" />
  }

  if (error || !feedback) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-4">
          <Link
            href="/admin/feedback"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to feedback
          </Link>
        </div>
        <AdminErrorState
          title="Feedback not found"
          message="This feedback may have been deleted, or you may not have access."
          onRetry={loadFeedback}
        />
      </div>
    )
  }

  const displayName =
    feedback.user_name ||
    feedback.profiles?.full_name ||
    feedback.profiles?.username ||
    'Anonymous'

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-4">
        <Link
          href="/admin/feedback"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to feedback
        </Link>
      </div>

      <AdminPageHeader
        title={feedback.title}
        icon={MessageSquare}
        description={`${typeLabel(feedback.feedback_type)} · Submitted ${formatDate(feedback.created_at)}`}
        action={
          <button type="button" onClick={loadFeedback} className={AP.btnSecondary}>
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Refresh
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <AdminMotion className="lg:col-span-2 space-y-4 sm:space-y-6">
          <div className={`${AP.card} ${AP.cardPadding}`}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Feedback details</h2>
              <span
                className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold ${statusBadgeClass(
                  feedback.status
                )}`}
              >
                {statusLabel(feedback.status)}
              </span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap rounded-xl bg-gray-50/80 p-4">
              {feedback.message}
            </p>
          </div>

          {feedback.attachment_url && (
            <div className={`${AP.card} ${AP.cardPadding}`}>
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-sm font-semibold text-gray-900">Attachment</h2>
                <a
                  href={feedback.attachment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  Open full size <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <a
                href={feedback.attachment_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-xl border border-gray-100"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={feedback.attachment_url}
                  alt="Feedback attachment"
                  className="max-h-96 w-full object-contain bg-gray-50"
                />
              </a>
            </div>
          )}

          <div className={`${AP.card} ${AP.cardPadding} space-y-4`}>
            <h2 className="text-sm font-semibold text-gray-900">Admin actions</h2>

            <div>
              <label htmlFor="feedback-status" className="block text-sm font-medium text-gray-700 mb-1.5">
                Status
              </label>
              <select
                id="feedback-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as FeedbackStatus)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
              >
                {FEEDBACK_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="internal-notes" className="block text-sm font-medium text-gray-700 mb-1.5">
                Internal notes
              </label>
              <textarea
                id="internal-notes"
                rows={4}
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Private notes for the admin team…"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm resize-y"
              />
            </div>

            <div>
              <label htmlFor="admin-response" className="block text-sm font-medium text-gray-700 mb-1.5">
                Admin response / note
              </label>
              <textarea
                id="admin-response"
                rows={4}
                value={adminResponse}
                onChange={(e) => setAdminResponse(e.target.value)}
                placeholder="Optional response note (admin-only; not shown to users)…"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm resize-y"
              />
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button type="button" onClick={handleSave} disabled={saving} className={AP.btnPrimary}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={handleMarkCompleted}
                disabled={saving || status === 'completed'}
                className={AP.btnSecondary}
              >
                <CheckCircle2 className="w-4 h-4" />
                Mark completed
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white text-red-600 border border-red-200 rounded-xl text-sm font-medium hover:bg-red-50 transition-all disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </AdminMotion>

        <AdminMotion delay={60} className="space-y-4 sm:space-y-6">
          <div className={`${AP.card} ${AP.cardPadding}`}>
            <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-primary-600" aria-hidden="true" />
              User information
            </h2>
            <DetailRow label="Name" value={displayName} />
            <DetailRow label="Email" value={feedback.email || '—'} />
            <DetailRow
              label="Account"
              value={
                feedback.user_id ? (
                  feedback.profiles?.username ? (
                    <Link
                      href={`/admin/users/${feedback.user_id}`}
                      className="text-primary-600 hover:text-primary-700"
                    >
                      @{feedback.profiles.username}
                    </Link>
                  ) : (
                    <Link
                      href={`/admin/users/${feedback.user_id}`}
                      className="text-primary-600 hover:text-primary-700"
                    >
                      View profile
                    </Link>
                  )
                ) : (
                  'Guest'
                )
              }
            />
            {feedback.profiles?.avatar_url && (
              <div className="pt-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={feedback.profiles.avatar_url}
                  alt={displayName}
                  className="w-12 h-12 rounded-full object-cover ring-2 ring-white shadow-sm"
                />
              </div>
            )}
          </div>

          <div className={`${AP.card} ${AP.cardPadding}`}>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Timeline</h2>
            <DetailRow label="Submitted" value={formatDate(feedback.created_at)} />
            <DetailRow label="Last updated" value={formatDate(feedback.updated_at)} />
            <DetailRow label="Reviewed" value={formatDate(feedback.reviewed_at)} />
            <DetailRow label="Type" value={typeLabel(feedback.feedback_type)} />
            <DetailRow
              label="Status"
              value={
                <span
                  className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold ${statusBadgeClass(
                    feedback.status
                  )}`}
                >
                  {statusLabel(feedback.status)}
                </span>
              }
            />
            <DetailRow label="Feedback ID" value={<span className="font-mono text-xs">{feedback.id}</span>} />
          </div>
        </AdminMotion>
      </div>
    </div>
  )
}
