'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import StatusBadge from '@/features/youth-leadership/components/StatusBadge'
import EmptyState from '@/features/youth-leadership/components/EmptyState'
import YouthAvatar from '@/features/youth-leadership/components/YouthAvatar'
import YouthSkeleton from '@/features/youth-leadership/components/YouthSkeleton'
import YouthSectionHeader from '@/features/youth-leadership/components/YouthSectionHeader'
import {
  YOUTH_CARD_INTERACTIVE,
  YOUTH_SELECT,
} from '@/features/youth-leadership/constants/nav'
import type { YouthProgramApplication } from '@/shared/types/youthLeadership'

type ApplicationRow = YouthProgramApplication & {
  program?: {
    id: string
    title: string
    status: string
    organization_id: string
    organization?: { id: string; name: string; logo_url: string | null } | null
  } | null
}

export default function ApplicationsPanel() {
  const { user, loading: authLoading } = useAuth()
  const [items, setItems] = useState<ApplicationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiClient.get<ApplicationRow[]>(
        '/api/youth-leadership/applications',
        { status: status || undefined }
      )
      setItems(Array.isArray(data) ? data : [])
    } catch (err) {
      setItems([])
      toast.error(err instanceof ApiError ? err.message : 'Failed to load applications')
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    if (authLoading || !user) return
    load()
  }, [authLoading, user?.id, load])

  if (authLoading) return <YouthSkeleton count={4} variant="row" />
  if (!user) return <EmptyState title="Sign in required" />

  return (
    <div className="space-y-4">
      <YouthSectionHeader
        title="Your applications"
        badge={
          !loading ? (
            <span className="rounded-full bg-surface-secondary px-2.5 py-0.5 text-xs font-medium text-content-secondary">
              {items.length} shown
            </span>
          ) : null
        }
      >
        <select
          className={`${YOUTH_SELECT} h-10`}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {[
            'draft',
            'submitted',
            'under_review',
            'accepted',
            'waitlisted',
            'rejected',
            'withdrawn',
            'completed',
          ].map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </YouthSectionHeader>

      {loading ? (
        <YouthSkeleton count={4} variant="row" />
      ) : items.length === 0 ? (
        <EmptyState
          title="No applications yet"
          description="Browse published programs and submit your first application."
          action={
            <Link href="/youth-leadership" className="btn-primary">
              Discover programs
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {items.map((app) => (
            <li key={app.id}>
              <Link
                href={`/youth-leadership/programs/${app.program_id}`}
                className={`${YOUTH_CARD_INTERACTIVE} block`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <YouthAvatar
                      src={app.program?.organization?.logo_url}
                      name={app.program?.organization?.name || 'Organization'}
                    />
                    <div className="min-w-0">
                      <p className="text-xs text-content-tertiary">
                        {app.program?.organization?.name || 'Organization'}
                      </p>
                      <p className="mt-0.5 truncate text-base font-semibold text-content">
                        {app.program?.title || 'Program'}
                      </p>
                      <p className="mt-1 text-xs text-content-tertiary">
                        {app.submitted_at
                          ? `Submitted ${new Date(app.submitted_at).toLocaleString()}`
                          : `Updated ${new Date(app.updated_at).toLocaleString()}`}
                      </p>
                      {app.guardian_approval_status &&
                      app.guardian_approval_status !== 'not_required' ? (
                        <p className="mt-1 text-xs capitalize text-content-secondary">
                          Guardian: {app.guardian_approval_status.replace(/_/g, ' ')}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <StatusBadge status={app.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
