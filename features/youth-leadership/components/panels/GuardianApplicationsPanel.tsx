'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import EmptyState from '@/features/youth-leadership/components/EmptyState'
import StatusBadge from '@/features/youth-leadership/components/StatusBadge'
import YouthAvatar from '@/features/youth-leadership/components/YouthAvatar'
import YouthSkeleton from '@/features/youth-leadership/components/YouthSkeleton'
import YouthSectionHeader from '@/features/youth-leadership/components/YouthSectionHeader'
import { YOUTH_CARD } from '@/features/youth-leadership/constants/nav'
import { ShieldCheck } from '@/shared/icons'

type GuardianPayload = {
  applications: any[]
  mentorships: any[]
}

export default function GuardianApplicationsPanel() {
  const { user, loading: authLoading } = useAuth()
  const [applications, setApplications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    try {
      const payload = await apiClient.get<GuardianPayload>('/api/youth-leadership/guardian')
      setApplications(payload?.applications || [])
    } catch (err) {
      if (!opts?.silent) setApplications([])
      toast.error(err instanceof ApiError ? err.message : 'Failed to load approvals')
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading || !user) return
    load()
  }, [authLoading, user?.id, load])

  async function reviewApplication(id: string, status: 'approved' | 'rejected') {
    setBusyId(id)
    try {
      await apiClient.patch(`/api/youth-leadership/applications/${id}`, {
        guardian_approval_status: status,
      })
      toast.success(status === 'approved' ? 'Application approved' : 'Application rejected')
      setApplications((list) => list.filter((app) => app.id !== id))
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Update failed')
    } finally {
      setBusyId(null)
    }
  }

  if (authLoading || loading) return <YouthSkeleton count={3} variant="row" />
  if (!user) return <EmptyState title="Sign in required" />

  return (
    <>
      <YouthSectionHeader
        title="Program applications"
        badge={
          <span className="rounded-full bg-surface-secondary px-2.5 py-0.5 text-xs font-medium text-content-secondary">
            {applications.length} pending
          </span>
        }
      />

      {applications.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No pending program approvals"
          description="When a child applies to a program that needs guardian approval, it will appear here."
        />
      ) : (
        <ul className="space-y-3">
          {applications.map((app) => {
            const childName =
              app.applicant?.full_name || app.applicant?.username || 'Child'
            return (
              <li key={app.id} className={YOUTH_CARD}>
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <YouthAvatar src={app.applicant?.avatar_url} name={childName} />
                    <div>
                      <p className="font-medium text-content">
                        {app.program?.title || 'Program'}
                      </p>
                      <p className="mt-1 text-sm text-content-secondary">
                        Participant: {childName}
                      </p>
                      <div className="mt-2">
                        <StatusBadge status={app.status} />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      disabled={busyId === app.id}
                      onClick={() => reviewApplication(app.id, 'rejected')}
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      className="btn-primary btn-sm"
                      disabled={busyId === app.id}
                      onClick={() => reviewApplication(app.id, 'approved')}
                    >
                      Approve
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
