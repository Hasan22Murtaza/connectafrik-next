'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  Clock,
  Eye,
  Flag,
  Inbox,
  RefreshCw,
  Search,
  XCircle,
} from '@/shared/icons'
import toast from 'react-hot-toast'
import { AdminLoading } from '@/features/admin/components/AdminLoading'
import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader'
import { AdminStatCard } from '@/features/admin/components/AdminStatCard'
import { AdminEmptyState } from '@/features/admin/components/AdminEmptyState'
import { AdminMotion } from '@/features/admin/components/AdminMotion'
import { AdminStatusBadge } from '@/features/admin/components/AdminStatusBadge'
import {
  AdminTableBody,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeadCell,
  AdminTableRow,
} from '@/features/admin/components/AdminTable'
import { AdminTableSkeleton } from '@/features/admin/components/skeletons/AdminShimmerLoaders'
import { useAdminAuth } from '@/features/admin/hooks/useAdminAuth'
import { AP } from '@/features/admin/constants/adminLayout'
import { listAdminReportGroups } from '@/features/social/services/reportService'
import {
  POST_REPORT_REASON_LABELS,
  POST_REPORT_REASON_OPTIONS,
  POST_REPORT_STATUS_LABELS,
  POST_REPORT_STATUS_OPTIONS,
  type PostReportGroup,
  type PostReportReason,
  type PostReportStats,
  type PostReportStatus,
  type ReasonCounts,
  type ReportProfile,
} from '@/lib/reports/types'

const LIMIT = 20

const emptyStats: PostReportStats = {
  total: 0,
  pending: 0,
  under_review: 0,
  resolved: 0,
  dismissed: 0,
}

const IMAGE_RE = /\.(jpg|jpeg|png|gif|webp|bmp|svg|jfif|avif)(\?|#|$)/i

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

function postPreview(group: PostReportGroup) {
  const content = group.post?.content?.trim()
  if (content) return content.length > 80 ? `${content.slice(0, 80).trimEnd()}…` : content
  if (group.post?.media_urls?.length) return 'Media post'
  return 'Untitled post'
}

function postThumbnail(group: PostReportGroup): string | null {
  const urls = group.post?.media_urls || []
  return urls.find((url) => IMAGE_RE.test(url)) || null
}

function reasonBreakdown(counts: ReasonCounts) {
  return POST_REPORT_REASON_OPTIONS.filter((opt) => (counts[opt.value] || 0) > 0).map((opt) => ({
    ...opt,
    count: counts[opt.value] || 0,
  }))
}

export default function AdminReportsPage() {
  const { isReady, authLoading } = useAdminAuth('/admin/reports')
  const [items, setItems] = useState<PostReportGroup[]>([])
  const [stats, setStats] = useState<PostReportStats>(emptyStats)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState<PostReportStatus | 'all'>('all')
  const [reason, setReason] = useState<PostReportReason | 'all'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [minReports, setMinReports] = useState('1')
  const [author, setAuthor] = useState('')
  const [authorInput, setAuthorInput] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const loadReports = useCallback(async () => {
    try {
      setLoading(true)
      const result = await listAdminReportGroups({
        status,
        reason,
        search: search || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo ? `${dateTo}T23:59:59.999Z` : undefined,
        author: author.trim() || undefined,
        min_reports: Number(minReports) || 1,
        page,
        limit: LIMIT,
        include_stats: true,
      })
      setItems(result.items)
      setTotal(result.total)
      setStats(result.stats || emptyStats)
    } catch {
      toast.error('Unable to load reports — admin access required')
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [status, reason, search, dateFrom, dateTo, author, minReports, page])

  useEffect(() => {
    if (!isReady) return
    loadReports()
  }, [isReady, loadReports])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(0)
    setSearch(searchInput.trim())
    setAuthor(authorInput.trim())
  }

  if (authLoading || !isReady) {
    return <AdminLoading variant="users" />
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  return (
    <div className="max-w-7xl mx-auto">
      <AdminPageHeader
        title="Reports"
        icon={Flag}
        description="Review reported posts, grouped by post so repeat reports surface together"
        action={
          <button type="button" onClick={loadReports} className={AP.btnSecondary}>
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Refresh
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4 mb-6">
        <AdminStatCard label="Total" value={stats.total} icon={Inbox} />
        <AdminStatCard
          label="Pending"
          value={stats.pending}
          icon={Clock}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
          highlight={stats.pending > 0}
        />
        <AdminStatCard
          label="Under Review"
          value={stats.under_review}
          icon={Eye}
          iconColor="text-orange-600"
          iconBg="bg-orange-50"
        />
        <AdminStatCard
          label="Resolved"
          value={stats.resolved}
          icon={CheckCircle2}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <AdminStatCard
          label="Dismissed"
          value={stats.dismissed}
          icon={XCircle}
          iconColor="text-gray-600"
          iconBg="bg-gray-100"
        />
      </div>

      <AdminMotion delay={40} className={`${AP.card} p-4 sm:p-5 mb-4`}>
        <form
          onSubmit={handleSearchSubmit}
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3"
        >
          <div className="relative xl:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search post title, post ID, username, or reporter…"
              className={AP.searchInput}
            />
          </div>
          <select
            value={status}
            onChange={(e) => {
              setPage(0)
              setStatus(e.target.value as PostReportStatus | 'all')
            }}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All statuses</option>
            {POST_REPORT_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={reason}
            onChange={(e) => {
              setPage(0)
              setReason(e.target.value as PostReportReason | 'all')
            }}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All reasons</option>
            {POST_REPORT_REASON_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setPage(0)
              setDateFrom(e.target.value)
            }}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            aria-label="From date"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setPage(0)
              setDateTo(e.target.value)
            }}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            aria-label="To date"
          />
          <select
            value={minReports}
            onChange={(e) => {
              setPage(0)
              setMinReports(e.target.value)
            }}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            aria-label="Number of reports"
          >
            <option value="1">Any number of reports</option>
            <option value="2">2+ reports</option>
            <option value="5">5+ reports</option>
            <option value="10">10+ reports</option>
          </select>
          <input
            value={authorInput}
            onChange={(e) => setAuthorInput(e.target.value)}
            placeholder="Filter by post author"
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            aria-label="Post author"
          />
          <button type="submit" className={AP.btnSecondary}>
            Apply filters
          </button>
        </form>
      </AdminMotion>

      <AdminMotion delay={80} className={`${AP.card} overflow-hidden`}>
        {loading ? (
          <div className="p-4">
            <AdminTableSkeleton rows={8} />
          </div>
        ) : items.length === 0 ? (
          <AdminEmptyState
            icon={Flag}
            title="No reports found"
            description="Try adjusting filters, or check back when users report posts."
          />
        ) : (
          <>
            <div className={AP.tableWrap}>
              <table className={`${AP.table} table-fixed min-w-[920px]`}>
                <colgroup>
                  <col className="w-[88px]" />
                  <col className="w-[220px]" />
                  <col className="w-[120px]" />
                  <col className="w-[120px]" />
                  <col className="w-[140px]" />
                  <col className="w-[80px]" />
                  <col className="w-[150px]" />
                  <col className="w-[110px]" />
                  <col className="w-[88px]" />
                </colgroup>
                <AdminTableHead>
                  <AdminTableHeadCell>Report ID</AdminTableHeadCell>
                  <AdminTableHeadCell>Post</AdminTableHeadCell>
                  <AdminTableHeadCell>Author</AdminTableHeadCell>
                  <AdminTableHeadCell>Reported by</AdminTableHeadCell>
                  <AdminTableHeadCell>Reason</AdminTableHeadCell>
                  <AdminTableHeadCell>Reports</AdminTableHeadCell>
                  <AdminTableHeadCell>Date</AdminTableHeadCell>
                  <AdminTableHeadCell>Status</AdminTableHeadCell>
                  <AdminTableHeadCell>Actions</AdminTableHeadCell>
                </AdminTableHead>
                <AdminTableBody>
                  {items.map((group) => {
                    const thumb = postThumbnail(group)
                    const breakdown = reasonBreakdown(group.reason_counts)
                    return (
                      <AdminTableRow key={group.post_id}>
                        <AdminTableCell className="font-mono text-xs text-gray-600 align-middle">
                          {shortId(group.latest_report_id)}
                        </AdminTableCell>
                        <AdminTableCell className="align-middle">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                              {thumb ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={thumb}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[10px] font-medium text-gray-400">
                                  Text
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">
                                Post #{shortId(group.post_id)}
                                {group.post?.is_deleted ? (
                                  <span className="ml-2 text-xs font-medium text-red-600">
                                    Removed
                                  </span>
                                ) : null}
                              </p>
                              <p className="text-xs text-gray-500 truncate mt-0.5">
                                {postPreview(group)}
                              </p>
                            </div>
                          </div>
                        </AdminTableCell>
                        <AdminTableCell className="truncate align-middle">
                          {profileName(group.post?.author)}
                        </AdminTableCell>
                        <AdminTableCell className="truncate align-middle">
                          {group.report_count > 1
                            ? `${group.report_count} users`
                            : profileName(group.latest_reporter)}
                        </AdminTableCell>
                        <AdminTableCell className="align-middle">
                          <div className="space-y-0.5 min-w-0">
                            {breakdown.length > 0 ? (
                              breakdown.map((item) => (
                                <p key={item.value} className="text-xs text-gray-700 truncate">
                                  {item.count} × {item.label}
                                </p>
                              ))
                            ) : (
                              <p className="text-xs text-gray-700 truncate">
                                {POST_REPORT_REASON_LABELS[group.latest_reason]}
                              </p>
                            )}
                          </div>
                        </AdminTableCell>
                        <AdminTableCell className="font-semibold tabular-nums align-middle">
                          {group.report_count}
                        </AdminTableCell>
                        <AdminTableCell className="whitespace-nowrap text-gray-600 align-middle">
                          {formatDate(group.last_reported_at)}
                        </AdminTableCell>
                        <AdminTableCell className="align-middle">
                          <AdminStatusBadge
                            status={POST_REPORT_STATUS_LABELS[group.status]}
                          />
                        </AdminTableCell>
                        <AdminTableCell className="align-middle">
                          <Link
                            href={`/admin/reports/${group.post_id}`}
                            className="text-sm font-medium text-primary-600 hover:text-primary-700"
                          >
                            Review
                          </Link>
                        </AdminTableCell>
                      </AdminTableRow>
                    )
                  })}
                </AdminTableBody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 bg-gray-50/60">
              <p className="text-xs text-gray-500">
                Showing {items.length} of {total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className={AP.btnSecondary}
                >
                  Previous
                </button>
                <span className="text-xs text-gray-500">
                  {page + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className={AP.btnSecondary}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </AdminMotion>
    </div>
  )
}
