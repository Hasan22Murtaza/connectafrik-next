'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import YouthShell from '@/features/youth-leadership/components/YouthShell'
import EmptyState from '@/features/youth-leadership/components/EmptyState'
import StatusBadge from '@/features/youth-leadership/components/StatusBadge'
import YouthAvatar from '@/features/youth-leadership/components/YouthAvatar'
import { YOUTH_CARD } from '@/features/youth-leadership/constants/nav'

type GuardianPayload = {
  applications: any[]
  mentorships: any[]
}

export default function YouthGuardianPage() {
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = useState<GuardianPayload>({ applications: [], mentorships: [] })
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const payload = await apiClient.get<GuardianPayload>('/api/youth-leadership/guardian')
      setData({
        applications: payload?.applications || [],
        mentorships: payload?.mentorships || [],
      })
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load approvals')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading || !user) return
    load()
  }, [authLoading, user, load])

  async function reviewApplication(id: string, status: 'approved' | 'rejected') {
    setBusyId(id)
    try {
      await apiClient.patch(`/api/youth-leadership/applications/${id}`, {
        guardian_approval_status: status,
      })
      toast.success(status === 'approved' ? 'Application approved' : 'Application rejected')
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Update failed')
    } finally {
      setBusyId(null)
    }
  }

  async function reviewMentorship(id: string, status: 'approved' | 'rejected') {
    setBusyId(id)
    try {
      await apiClient.patch(`/api/youth-leadership/mentorship/${id}`, {
        guardian_approval_status: status,
      })
      toast.success(status === 'approved' ? 'Mentorship approved' : 'Mentorship rejected')
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Update failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <YouthShell
      title="Guardian approvals"
      subtitle="Review Youth Leadership requests that require parent or guardian authorization. Private messages are never shown here."
    >
      {loading ? (
        <div className={`${YOUTH_CARD} text-sm text-content-secondary`}>Loading…</div>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-base font-semibold text-content-primary">
              Program applications
            </h2>
            {data.applications.length === 0 ? (
              <EmptyState title="No pending program approvals" />
            ) : (
              <div className="space-y-3">
                {data.applications.map((app) => {
                  const childName =
                    app.applicant?.full_name || app.applicant?.username || 'Child'
                  return (
                  <div key={app.id} className={YOUTH_CARD}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <YouthAvatar src={app.applicant?.avatar_url} name={childName} />
                        <div>
                          <p className="font-medium text-content-primary">
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
                  </div>
                  )
                })}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-content-primary">
              Mentorship requests
            </h2>
            {data.mentorships.length === 0 ? (
              <EmptyState title="No pending mentorship approvals" />
            ) : (
              <div className="space-y-3">
                {data.mentorships.map((m) => {
                  const mentorName =
                    m.mentor?.profile?.full_name ||
                    m.mentor?.profile?.username ||
                    'Mentor'
                  const childName =
                    m.participant?.full_name || m.participant?.username || 'Child'
                  return (
                  <div key={m.id} className={YOUTH_CARD}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex -space-x-2">
                          <YouthAvatar
                            src={m.mentor?.profile?.avatar_url}
                            name={mentorName}
                          />
                          <YouthAvatar
                            src={m.participant?.avatar_url}
                            name={childName}
                            className="ring-2 ring-surface-primary"
                          />
                        </div>
                        <div>
                          <p className="font-medium text-content-primary">
                            Mentor: {mentorName}
                          </p>
                          <p className="mt-1 text-sm text-content-secondary">
                            Participant: {childName}
                          </p>
                          <div className="mt-2">
                            <StatusBadge status={m.status} />
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          disabled={busyId === m.id}
                          onClick={() => reviewMentorship(m.id, 'rejected')}
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          className="btn-primary btn-sm"
                          disabled={busyId === m.id}
                          onClick={() => reviewMentorship(m.id, 'approved')}
                        >
                          Approve
                        </button>
                      </div>
                    </div>
                  </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </YouthShell>
  )
}
