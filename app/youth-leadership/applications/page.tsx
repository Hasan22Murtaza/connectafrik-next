'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import YouthShell from '@/features/youth-leadership/components/YouthShell'
import StatusBadge from '@/features/youth-leadership/components/StatusBadge'
import EmptyState from '@/features/youth-leadership/components/EmptyState'
import YouthAvatar from '@/features/youth-leadership/components/YouthAvatar'
import { YOUTH_CARD } from '@/features/youth-leadership/constants/nav'
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

export default function YouthApplicationsPage() {
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
  }, [authLoading, user, load])

  return (
    <YouthShell
      title="My Applications"
      subtitle="Track status for every program you have applied to."
      actions={
        <select
          className="rounded-lg border border-border bg-surface-primary px-3 py-2 text-sm"
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
      }
    >
      {authLoading || loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`${YOUTH_CARD} h-20 animate-pulse bg-surface-secondary`} />
          ))}
        </div>
      ) : !user ? (
        <EmptyState title="Sign in required" />
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
            <li key={app.id} className={YOUTH_CARD}>
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
                    <Link
                      href={`/youth-leadership/programs/${app.program_id}`}
                      className="mt-0.5 block truncate text-base font-semibold text-content-primary hover:text-primary"
                    >
                      {app.program?.title || 'Program'}
                    </Link>
                    <p className="mt-1 text-xs text-content-tertiary">
                      {app.submitted_at
                        ? `Submitted ${new Date(app.submitted_at).toLocaleString()}`
                        : `Updated ${new Date(app.updated_at).toLocaleString()}`}
                    </p>
                  </div>
                </div>
                <StatusBadge status={app.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </YouthShell>
  )
}
