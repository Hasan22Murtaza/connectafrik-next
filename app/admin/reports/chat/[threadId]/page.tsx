'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  RefreshCw,
} from '@/shared/icons'
import toast from 'react-hot-toast'
import { AdminErrorState } from '@/features/admin/components/AdminErrorState'
import { AdminLoading } from '@/features/admin/components/AdminLoading'
import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader'
import { AdminMotion } from '@/features/admin/components/AdminMotion'
import { AdminStatusBadge } from '@/features/admin/components/AdminStatusBadge'
import { useAdminAuth } from '@/features/admin/hooks/useAdminAuth'
import { AP } from '@/features/admin/constants/adminLayout'
import {
  applyAdminChatReportAction,
  getAdminChatReportGroup,
} from '@/features/social/services/reportService'
import {
  CHAT_USER_REPORT_ACTION_LABELS,
  POST_REPORT_REASON_LABELS,
  POST_REPORT_REASON_OPTIONS,
  POST_REPORT_STATUS_LABELS,
  type ChatUserReportActionType,
  type ChatUserReportGroupDetail,
  type ReportProfile,
} from '@/lib/reports/types'

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

function shortId(id: string) {
  return id.slice(0, 8)
}

function profileName(profile: ReportProfile | null | undefined) {
  if (!profile) return 'Unknown'
  return profile.full_name || (profile.username ? `@${profile.username}` : 'Unknown')
}

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

type ConfirmAction = ChatUserReportActionType

export default function AdminChatReportDetailPage() {
  const params = useParams()
  const threadId = params?.threadId as string
  const { isReady, authLoading } = useAdminAuth('/admin/reports')

  const [detail, setDetail] = useState<ChatUserReportGroupDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [notes, setNotes] = useState('')
  const [acting, setActing] = useState(false)

  const loadDetail = useCallback(async () => {
    if (!threadId) return
    try {
      setLoading(true)
      setError(false)
      const data = await getAdminChatReportGroup(threadId)
      setDetail(data)
    } catch {
      setError(true)
      toast.error('Unable to load chat report')
    } finally {
      setLoading(false)
    }
  }, [threadId])

  useEffect(() => {
    if (!isReady) return
    loadDetail()
  }, [isReady, loadDetail])

  const closeConfirm = () => {
    if (acting) return
    setConfirmAction(null)
    setNotes('')
  }

  const handleConfirm = async () => {
    if (!threadId || !confirmAction) return
    setActing(true)
    try {
      const updated = await applyAdminChatReportAction(threadId, {
        action: confirmAction,
        notes: notes.trim() || undefined,
      })
      setDetail(updated)
      toast.success(
        confirmAction === 'dismiss'
          ? 'Report dismissed.'
          : confirmAction === 'warn_user'
            ? 'Warning sent to the reported user.'
            : 'User suspended.'
      )
      setConfirmAction(null)
      setNotes('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to apply action')
    } finally {
      setActing(false)
    }
  }

  if (authLoading || !isReady || loading) {
    return <AdminLoading variant="user-detail" />
  }

  if (error || !detail) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-4">
          <Link
            href="/admin/reports?tab=chats"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to chat reports
          </Link>
        </div>
        <AdminErrorState
          title="Chat report not found"
          message="This report may have been removed, or you may not have access."
          onRetry={loadDetail}
        />
      </div>
    )
  }

  const breakdown = POST_REPORT_REASON_OPTIONS.filter(
    (opt) => (detail.reason_counts[opt.value] || 0) > 0
  ).map((opt) => ({ ...opt, count: detail.reason_counts[opt.value] || 0 }))

  const latestSnapshot =
    detail.reports.find((report) => report.message_snapshot.length > 0)?.message_snapshot ||
    detail.reports[0]?.message_snapshot ||
    []

  const confirmCopy: Record<
    ConfirmAction,
    { title: string; body: string; confirm: string; danger?: boolean }
  > = {
    dismiss: {
      title: 'Dismiss this chat report?',
      body: 'Marks the report as dismissed with no action against the reported user.',
      confirm: 'Dismiss report',
    },
    warn_user: {
      title: 'Warn the reported user?',
      body: 'They will receive a community guidelines warning about this chat report.',
      confirm: 'Send warning',
    },
    suspend_user: {
      title: 'Suspend the reported user?',
      body: 'This prevents the user from signing in. Use this for serious violations.',
      confirm: 'Suspend user',
      danger: true,
    },
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-4">
        <Link
          href="/admin/reports?tab=chats"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to chat reports
        </Link>
      </div>

      <AdminPageHeader
        title={`Chat #${shortId(detail.thread_id)} — ${detail.report_count} Report${detail.report_count === 1 ? '' : 's'}`}
        icon={MessageSquare}
        description={`Last reported ${formatDate(detail.last_reported_at)}`}
        action={
          <button type="button" onClick={loadDetail} className={AP.btnSecondary}>
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Refresh
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <AdminMotion className="lg:col-span-2 space-y-4 sm:space-y-6">
          <div className={`${AP.card} ${AP.cardPadding}`}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Message snapshot</h2>
              <AdminStatusBadge status={POST_REPORT_STATUS_LABELS[detail.status]} />
            </div>
            {latestSnapshot.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No messages were included with this report.</p>
            ) : (
              <ul className="space-y-3">
                {latestSnapshot.map((message) => (
                  <li
                    key={message.id}
                    className="rounded-xl border border-gray-100 bg-gray-50/80 px-3.5 py-3"
                  >
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <p className="text-xs font-medium text-gray-500 font-mono">
                        {shortId(message.sender_id)}
                        {message.has_attachments ? ' · attachment' : ''}
                        {message.message_type ? ` · ${message.message_type}` : ''}
                      </p>
                      <p className="text-xs text-gray-400 shrink-0">
                        {formatDate(message.created_at)}
                      </p>
                    </div>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">
                      {message.content?.trim() || '(empty / encrypted / media-only)'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={`${AP.card} ${AP.cardPadding}`}>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              All reports against this chat
            </h2>
            <ul className="divide-y divide-gray-50">
              {detail.reports.map((report) => (
                <li key={report.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {profileName(report.reporter)}
                      {report.reporter?.username ? (
                        <span className="ml-1 text-gray-500 font-normal">
                          @{report.reporter.username}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-sm text-gray-700 mt-0.5">
                      {POST_REPORT_REASON_LABELS[report.reason]}
                    </p>
                    {report.notes ? (
                      <p className="text-sm text-gray-600 mt-1 rounded-lg bg-gray-50 px-3 py-2">
                        {report.notes}
                      </p>
                    ) : null}
                    <p className="text-xs text-gray-400 mt-1 font-mono">{shortId(report.id)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <AdminStatusBadge status={POST_REPORT_STATUS_LABELS[report.status]} />
                    <p className="text-xs text-gray-500 mt-1">{formatDate(report.created_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className={`${AP.card} ${AP.cardPadding}`}>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Previous admin actions</h2>
            {detail.actions.length === 0 ? (
              <p className="text-sm text-gray-500">No admin actions yet.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {detail.actions.map((action) => (
                  <li key={action.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-gray-900">
                        {CHAT_USER_REPORT_ACTION_LABELS[action.action]}
                      </p>
                      <p className="text-xs text-gray-500 shrink-0">{formatDate(action.created_at)}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      by {profileName(action.admin)}
                    </p>
                    {action.notes && (
                      <p className="text-sm text-gray-700 mt-2 rounded-lg bg-gray-50 px-3 py-2">
                        {action.notes}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </AdminMotion>

        <AdminMotion delay={40} className="space-y-4 sm:space-y-6">
          <div className={`${AP.card} ${AP.cardPadding}`}>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Reason breakdown</h2>
            <ul className="space-y-1.5">
              {breakdown.map((item) => (
                <li key={item.value} className="text-sm text-gray-700">
                  {item.count} × {item.label}
                </li>
              ))}
            </ul>
          </div>

          <div className={`${AP.card} ${AP.cardPadding}`}>
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Reported user</h2>
            <DetailRow label="Name" value={profileName(detail.reported_user)} />
            <DetailRow
              label="Username"
              value={
                detail.reported_user?.username ? `@${detail.reported_user.username}` : '—'
              }
            />
            {detail.reported_user?.id && (
              <Link
                href={`/admin/users/${detail.reported_user.id}`}
                className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-primary-600 hover:text-orange-500"
              >
                View user <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          <div className={`${AP.card} ${AP.cardPadding}`}>
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Latest reporter</h2>
            <DetailRow label="Name" value={profileName(detail.latest_reporter)} />
            <DetailRow
              label="Username"
              value={
                detail.latest_reporter?.username
                  ? `@${detail.latest_reporter.username}`
                  : '—'
              }
            />
            <DetailRow label="First reported" value={formatDate(detail.first_reported_at)} />
            <DetailRow label="Last reported" value={formatDate(detail.last_reported_at)} />
          </div>

          <div className={`${AP.card} ${AP.cardPadding} space-y-2`}>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Admin actions</h2>
            <button
              type="button"
              onClick={() => setConfirmAction('dismiss')}
              className={AP.btnSecondary + ' w-full'}
            >
              <CheckCircle2 className="w-4 h-4" />
              Dismiss report
            </button>
            <button
              type="button"
              onClick={() => setConfirmAction('warn_user')}
              className={AP.btnSecondary + ' w-full'}
            >
              <AlertTriangle className="w-4 h-4" />
              Warn user
            </button>
            <button
              type="button"
              onClick={() => setConfirmAction('suspend_user')}
              className="inline-flex items-center justify-center gap-2 w-full px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-medium hover:bg-amber-700 transition-all"
            >
              <Ban className="w-4 h-4" />
              Suspend user
            </button>
          </div>
        </AdminMotion>
      </div>

      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className={`${AP.card} shadow-2xl w-full max-w-md p-6`}>
            <h2 className="font-semibold text-lg mb-1">{confirmCopy[confirmAction].title}</h2>
            <p className="text-sm text-gray-500 mb-4">{confirmCopy[confirmAction].body}</p>
            <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="chat-action-notes">
              Notes (optional)
            </label>
            <textarea
              id="chat-action-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal note for the moderation log…"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm resize-y mb-4"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={acting}
                className={`flex-1 px-4 py-2 text-white rounded-xl text-sm font-medium active:scale-[0.98] transition-all disabled:opacity-50 ${
                  confirmCopy[confirmAction].danger
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-primary-600 hover:bg-primary-700'
                }`}
              >
                {acting ? 'Working…' : confirmCopy[confirmAction].confirm}
              </button>
              <button
                type="button"
                onClick={closeConfirm}
                disabled={acting}
                className={AP.btnSecondary}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
