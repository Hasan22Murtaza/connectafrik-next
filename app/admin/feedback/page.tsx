'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  Clock,
  Eye,
  Filter,
  Inbox,
  MessageSquare,
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
import {
  FEEDBACK_STATUS_OPTIONS,
  FEEDBACK_TYPE_OPTIONS,
  listAdminFeedback,
} from '@/features/feedback/services/feedbackService'
import type {
  FeedbackStats,
  FeedbackStatus,
  FeedbackType,
  FeedbackWithUser,
} from '@/lib/feedback/types'

const LIMIT = 20

const emptyStats: FeedbackStats = {
  total: 0,
  new: 0,
  under_review: 0,
  planned: 0,
  in_progress: 0,
  completed: 0,
  rejected: 0,
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

export default function AdminFeedbackPage() {
  const { isReady, authLoading } = useAdminAuth('/admin/feedback')
  const [items, setItems] = useState<FeedbackWithUser[]>([])
  const [stats, setStats] = useState<FeedbackStats>(emptyStats)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState<FeedbackStatus | 'all'>('all')
  const [type, setType] = useState<FeedbackType | 'all'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const loadFeedback = useCallback(async () => {
    try {
      setLoading(true)
      const result = await listAdminFeedback({
        status,
        type,
        search: search || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo ? `${dateTo}T23:59:59.999Z` : undefined,
        page,
        limit: LIMIT,
        include_stats: true,
      })
      setItems(result.items)
      setTotal(result.total)
      setStats(result.stats || emptyStats)
    } catch {
      toast.error('Unable to load feedback — admin access required')
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [status, type, search, dateFrom, dateTo, page])

  useEffect(() => {
    if (!isReady) return
    loadFeedback()
  }, [isReady, loadFeedback])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(0)
    setSearch(searchInput.trim())
  }

  if (authLoading || !isReady) {
    return <AdminLoading variant="users" />
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  return (
    <div className="max-w-7xl mx-auto">
      <AdminPageHeader
        title="Feedback"
        icon={MessageSquare}
        description="Review and manage user-submitted feedback"
        action={
          <button type="button" onClick={loadFeedback} className={AP.btnSecondary}>
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Refresh
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 sm:gap-4 mb-6">
        <AdminStatCard label="Total" value={stats.total} icon={Inbox} />
        <AdminStatCard
          label="New"
          value={stats.new}
          icon={MessageSquare}
          iconColor="text-sky-600"
          iconBg="bg-sky-50"
          highlight={stats.new > 0}
        />
        <AdminStatCard
          label="Under Review"
          value={stats.under_review}
          icon={Eye}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
        />
        <AdminStatCard
          label="Planned"
          value={stats.planned}
          icon={Clock}
          iconColor="text-violet-600"
          iconBg="bg-violet-50"
        />
        <AdminStatCard
          label="In Progress"
          value={stats.in_progress}
          icon={Filter}
          iconColor="text-orange-600"
          iconBg="bg-orange-50"
        />
        <AdminStatCard
          label="Completed"
          value={stats.completed}
          icon={CheckCircle2}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <AdminStatCard
          label="Rejected"
          value={stats.rejected}
          icon={XCircle}
          iconColor="text-red-600"
          iconBg="bg-red-50"
        />
      </div>

      <AdminMotion delay={40} className={`${AP.card} p-4 sm:p-5 mb-4`}>
        <form
          onSubmit={handleSearchSubmit}
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3"
        >
          <div className="relative xl:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search title, message, email, name…"
              className={AP.searchInput}
            />
          </div>
          <select
            value={status}
            onChange={(e) => {
              setPage(0)
              setStatus(e.target.value as FeedbackStatus | 'all')
            }}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All statuses</option>
            {FEEDBACK_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={type}
            onChange={(e) => {
              setPage(0)
              setType(e.target.value as FeedbackType | 'all')
            }}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All types</option>
            {FEEDBACK_TYPE_OPTIONS.map((opt) => (
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
        </form>
      </AdminMotion>

      <AdminMotion delay={80} className={`${AP.card} overflow-hidden`}>
        {loading ? (
          <div className="p-4">
            <AdminTableSkeleton rows={8} />
          </div>
        ) : items.length === 0 ? (
          <AdminEmptyState
            icon={MessageSquare}
            title="No feedback found"
            description="Try adjusting filters, or check back after users submit feedback."
          />
        ) : (
          <>
            <div className={AP.tableWrap}>
              <table className={AP.table}>
                <AdminTableHead>
                  <tr>
                    <AdminTableHeadCell>Title</AdminTableHeadCell>
                    <AdminTableHeadCell>Type</AdminTableHeadCell>
                    <AdminTableHeadCell>Status</AdminTableHeadCell>
                    <AdminTableHeadCell>Submitted</AdminTableHeadCell>
                    <AdminTableHeadCell>Action</AdminTableHeadCell>
                  </tr>
                </AdminTableHead>
                <AdminTableBody>
                  {items.map((item) => (
                    <AdminTableRow key={item.id}>
                      <AdminTableCell>
                        <Link
                          href={`/admin/feedback/${item.id}`}
                          className="font-medium text-gray-900 hover:text-primary-600 line-clamp-1"
                        >
                          {item.title}
                        </Link>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                          {item.user_name ||
                            item.profiles?.full_name ||
                            item.email ||
                            'Anonymous'}
                        </p>
                      </AdminTableCell>
                      <AdminTableCell>
                        <span className="text-xs text-gray-600">
                          {typeLabel(item.feedback_type)}
                        </span>
                      </AdminTableCell>
                      <AdminTableCell>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold ${statusBadgeClass(
                            item.status
                          )}`}
                        >
                          {statusLabel(item.status)}
                        </span>
                      </AdminTableCell>
                      <AdminTableCell>
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {formatDate(item.created_at)}
                        </span>
                      </AdminTableCell>
                      <AdminTableCell>
                        <Link
                          href={`/admin/feedback/${item.id}`}
                          className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
                        >
                          View <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                        </Link>
                      </AdminTableCell>
                    </AdminTableRow>
                  ))}
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
