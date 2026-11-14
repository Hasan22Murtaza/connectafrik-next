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

export default function GuardianMentorshipsPanel() {
  const { user, loading: authLoading } = useAuth()
  const [mentorships, setMentorships] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    try {
      const payload = await apiClient.get<GuardianPayload>('/api/youth-leadership/guardian')
      setMentorships(payload?.mentorships || [])
    } catch (err) {
      if (!opts?.silent) setMentorships([])
      toast.error(err instanceof ApiError ? err.message : 'Failed to load approvals')
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading || !user) return
    load()
  }, [authLoading, user?.id, load])

  async function reviewMentorship(id: string, status: 'approved' | 'rejected') {
    setBusyId(id)
    try {
      await apiClient.patch(`/api/youth-leadership/mentorship/${id}`, {
        guardian_approval_status: status,
      })
      toast.success(status === 'approved' ? 'Mentorship approved' : 'Mentorship rejected')
      setMentorships((list) => list.filter((m) => m.id !== id))
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
        title="Mentorship requests"
        badge={
          <span className="rounded-full bg-surface-secondary px-2.5 py-0.5 text-xs font-medium text-content-secondary">
            {mentorships.length} pending
          </span>
        }
      />

      {mentorships.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No pending mentorship approvals"
          description="Mentorship matches that require guardian approval will show here for review."
        />
      ) : (
        <ul className="space-y-3">
          {mentorships.map((m) => {
            const mentorName =
              m.mentor?.profile?.full_name || m.mentor?.profile?.username || 'Mentor'
            const childName =
              m.participant?.full_name || m.participant?.username || 'Child'
            return (
              <li key={m.id} className={YOUTH_CARD}>
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex -space-x-2">
                      <YouthAvatar
                        src={m.mentor?.profile?.avatar_url}
                        name={mentorName}
                      />
                      <YouthAvatar
                        src={m.participant?.avatar_url}
                        name={childName}
                        className="ring-2 ring-surface"
                      />
                    </div>
                    <div>
                      <p className="font-medium text-content">Mentor: {mentorName}</p>
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
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
