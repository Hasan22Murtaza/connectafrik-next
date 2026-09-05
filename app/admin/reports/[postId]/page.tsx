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
  EyeOff,
  Flag,
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
  applyAdminReportAction,
  getAdminReportGroup,
} from '@/features/social/services/reportService'
import {
  POST_REPORT_ACTION_LABELS,
  POST_REPORT_REASON_LABELS,
  POST_REPORT_REASON_OPTIONS,
  POST_REPORT_STATUS_LABELS,
  type PostReportActionType,
  type PostReportGroupDetail,
  type ReportProfile,
} from '@/lib/reports/types'

const IMAGE_RE = /\.(jpg|jpeg|png|gif|webp|bmp|svg|jfif|avif)(\?|#|$)/i
const VIDEO_RE = /\.(mp4|webm|ogg|avi|mov|wmv|flv|mkv)(\?|#|$)/i

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

type ConfirmAction = Extract<
  PostReportActionType,
  'keep_post' | 'remove_post' | 'warn_user' | 'suspend_user'
>

export default function AdminReportDetailPage() {
  const params = useParams()
  const postId = params?.postId as string
  const { isReady, authLoading } = useAdminAuth('/admin/reports')

  const [detail, setDetail] = useState<PostReportGroupDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [notes, setNotes] = useState('')
  const [alsoRemove, setAlsoRemove] = useState(false)
  const [acting, setActing] = useState(false)

  const loadDetail = useCallback(async () => {
    if (!postId) return
    try {
      setLoading(true)
      setError(false)
      const data = await getAdminReportGroup(postId)
      setDetail(data)
    } catch {
      setError(true)
      toast.error('Unable to load report')
    } finally {
      setLoading(false)
    }
  }, [postId])

  useEffect(() => {
    if (!isReady) return
    loadDetail()
  }, [isReady, loadDetail])

  const closeConfirm = () => {
    if (acting) return
    setConfirmAction(null)
    setNotes('')
    setAlsoRemove(false)
  }

  const handleConfirm = async () => {
    if (!postId || !confirmAction) return
    setActing(true)
    try {
      const updated = await applyAdminReportAction(postId, {
        action: confirmAction,
        notes: notes.trim() || undefined,
        remove_post:
          confirmAction === 'warn_user' || confirmAction === 'suspend_user'
            ? alsoRemove
            : undefined,
      })
      setDetail(updated)
      toast.success(
        confirmAction === 'keep_post'
          ? 'Report dismissed. Post kept.'
          : confirmAction === 'remove_post'
            ? 'Post removed and report resolved.'
            : confirmAction === 'warn_user'
              ? alsoRemove
                ? 'Warning sent and post removed.'
                : 'Warning sent to the post owner.'
              : alsoRemove
                ? 'User suspended and post removed.'
                : 'User suspended.'
      )
      setConfirmAction(null)
      setNotes('')
      setAlsoRemove(false)
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
            href="/admin/reports"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to reports
          </Link>
        </div>
        <AdminErrorState
          title="Report not found"
          message="This report may have been removed, or you may not have access."
          onRetry={loadDetail}
        />
      </div>
    )
  }

  const mediaUrls = detail.post?.media_urls || []
  const imageUrls = mediaUrls.filter((url) => IMAGE_RE.test(url))
  const videoUrls = mediaUrls.filter((url) => VIDEO_RE.test(url))
  const breakdown = POST_REPORT_REASON_OPTIONS.filter(
    (opt) => (detail.reason_counts[opt.value] || 0) > 0
  ).map((opt) => ({ ...opt, count: detail.reason_counts[opt.value] || 0 }))

  const confirmCopy: Record<
    ConfirmAction,
    { title: string; body: string; confirm: string; danger?: boolean }
  > = {
    keep_post: {
      title: 'Keep this post?',
      body: 'This dismisses the report and leaves the post visible on the platform.',
      confirm: 'Keep post',
    },
    remove_post: {
      title: 'Remove this post?',
      body: 'The post will be hidden from the platform and the report will be marked resolved.',
      confirm: 'Remove post',
      danger: true,
    },
    warn_user: {
      title: 'Warn the post owner?',
      body: 'The author will receive a community guidelines warning. You can also hide the post.',
      confirm: 'Send warning',
    },
    suspend_user: {
      title: 'Suspend the post owner?',
      body: 'This prevents the author from signing in. Use this for serious violations.',
      confirm: 'Suspend user',
      danger: true,
    },
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-4">
        <Link
          href="/admin/reports"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to reports
        </Link>
      </div>

      <AdminPageHeader
        title={`Post #${shortId(detail.post_id)} — ${detail.report_count} Report${detail.report_count === 1 ? '' : 's'}`}
        icon={Flag}
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
              <h2 className="text-sm font-semibold text-gray-900">Reported post</h2>
              <AdminStatusBadge status={POST_REPORT_STATUS_LABELS[detail.status]} />
            </div>
            {detail.post?.is_deleted && (
              <p className="mb-3 text-sm font-medium text-red-600">
                This post has been removed from the platform.
              </p>
            )}
            {detail.post?.content?.trim() ? (
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap rounded-xl bg-gray-50/80 p-4">
                {detail.post.content}
              </p>
            ) : (
              <p className="text-sm text-gray-500 italic">No caption</p>
            )}
            {imageUrls.length > 0 && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {imageUrls.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="overflow-hidden rounded-xl border border-gray-100"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="Reported post media" className="max-h-80 w-full object-contain bg-gray-50" />
                  </a>
                ))}
              </div>
            )}
            {videoUrls.length > 0 && (
              <div className="mt-4 space-y-3">
                {videoUrls.map((url) => (
                  <video key={url} src={url} controls className="w-full rounded-xl bg-black max-h-80" />
                ))}
              </div>
            )}
            {detail.post && !detail.post.is_deleted && (
              <Link
                href={`/post/${detail.post_id}`}
                target="_blank"
                className="inline-flex items-center gap-1 mt-4 text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                Open post <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          <div className={`${AP.card} ${AP.cardPadding}`}>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              All reports against this post
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
                        {POST_REPORT_ACTION_LABELS[action.action]}
                      </p>
                      <p className="text-xs text-gray-500 shrink-0">{formatDate(action.created_at)}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      by {profileName(action.admin)}
                      {action.metadata?.removed_post ? ' · post removed' : ''}
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
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Post author</h2>
            <DetailRow label="Name" value={profileName(detail.post?.author)} />
            <DetailRow
              label="Username"
              value={detail.post?.author?.username ? `@${detail.post.author.username}` : '—'}
            />
            {detail.post?.author?.id && (
              <Link
                href={`/admin/users/${detail.post.author.id}`}
                className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-primary-600 hover:text-primary-700"
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
                detail.latest_reporter?.username ? `@${detail.latest_reporter.username}` : '—'
              }
            />
            <DetailRow label="First reported" value={formatDate(detail.first_reported_at)} />
            <DetailRow label="Last reported" value={formatDate(detail.last_reported_at)} />
          </div>

          <div className={`${AP.card} ${AP.cardPadding} space-y-2`}>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Admin actions</h2>
            <button
              type="button"
              onClick={() => setConfirmAction('keep_post')}
              className={AP.btnSecondary + ' w-full'}
            >
              <CheckCircle2 className="w-4 h-4" />
              Keep post
            </button>
            <button
              type="button"
              onClick={() => setConfirmAction('remove_post')}
              className="inline-flex items-center justify-center gap-2 w-full px-4 py-2 bg-white text-red-600 border border-red-200 rounded-xl text-sm font-medium hover:bg-red-50 transition-all"
            >
              <EyeOff className="w-4 h-4" />
              Remove post
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
            {(confirmAction === 'warn_user' || confirmAction === 'suspend_user') && (
              <label className="flex items-center gap-2 mb-4 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={alsoRemove}
                  onChange={(e) => setAlsoRemove(e.target.checked)}
                  className="h-4 w-4 accent-gray-900"
                />
                Also remove this post
              </label>
            )}
            <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="action-notes">
              Notes (optional)
            </label>
            <textarea
              id="action-notes"
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
