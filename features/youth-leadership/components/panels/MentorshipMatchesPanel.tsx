'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import StatusBadge from '@/features/youth-leadership/components/StatusBadge'
import EmptyState from '@/features/youth-leadership/components/EmptyState'
import SafetyReportButton from '@/features/youth-leadership/components/SafetyReportButton'
import YouthSkeleton from '@/features/youth-leadership/components/YouthSkeleton'
import YouthSectionHeader from '@/features/youth-leadership/components/YouthSectionHeader'
import YouthAvatar from '@/features/youth-leadership/components/YouthAvatar'
import { YOUTH_CARD } from '@/features/youth-leadership/constants/nav'
import type { YouthMentorshipMatch } from '@/shared/types/youthLeadership'

type MentorshipPayload = {
  as_participant: YouthMentorshipMatch[]
  as_mentor: (YouthMentorshipMatch & {
    participant?: {
      id: string
      username: string | null
      full_name: string | null
      avatar_url: string | null
    } | null
  })[]
}

export default function MentorshipMatchesPanel() {
  const { user, loading: authLoading } = useAuth()
  const [matches, setMatches] = useState<MentorshipPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const matchPayload = await apiClient.get<MentorshipPayload>(
        '/api/youth-leadership/mentorship'
      )
      setMatches(matchPayload)
    } catch (err) {
      setMatches(null)
      toast.error(err instanceof ApiError ? err.message : 'Failed to load matches')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading || !user) return
    load()
  }, [authLoading, user, load])

  async function updateMatch(id: string, action: string) {
    setBusy(true)
    try {
      await apiClient.patch(`/api/youth-leadership/mentorship/${id}`, { action })
      toast.success('Mentorship updated')
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  if (authLoading || loading) return <YouthSkeleton count={3} variant="row" />
  if (!user) return <EmptyState title="Sign in required" />

  const participantCount = matches?.as_participant.length ?? 0
  const mentorCount = matches?.as_mentor.length ?? 0
  const total = participantCount + mentorCount

  return (
    <>
      <YouthSectionHeader
        title="My matches"
        badge={
          <span className="rounded-full bg-surface-secondary px-2.5 py-0.5 text-xs font-medium text-content-secondary">
            {total} total
          </span>
        }
      />

      {total === 0 ? (
        <EmptyState
          title="No mentorship matches yet"
          description="Request a mentor from Find mentors, or wait for mentee requests if you mentor."
        />
      ) : (
        <ul className="space-y-3">
          {matches?.as_participant.map((m) => {
            const mentorName =
              m.mentor?.profile?.full_name || m.mentor?.profile?.username || 'Mentor'
            return (
              <li key={m.id} className={YOUTH_CARD}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <YouthAvatar src={m.mentor?.profile?.avatar_url} name={mentorName} />
                    <div>
                      <p className="text-sm font-medium text-content">
                        As participant · {mentorName}
                      </p>
                      <div className="mt-1">
                        <StatusBadge status={m.status} />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['requested', 'pending_guardian', 'active'].includes(m.status) ? (
                      <button
                        type="button"
                        className="btn-secondary text-sm"
                        disabled={busy}
                        onClick={() => updateMatch(m.id, 'cancel')}
                      >
                        Cancel
                      </button>
                    ) : null}
                    {m.status === 'active' ? (
                      <button
                        type="button"
                        className="btn-secondary text-sm"
                        disabled={busy}
                        onClick={() => updateMatch(m.id, 'complete')}
                      >
                        Complete
                      </button>
                    ) : null}
                    <SafetyReportButton
                      className="btn-secondary text-sm"
                      label="Report"
                      context={{ mentorship_id: m.id }}
                    />
                  </div>
                </div>
              </li>
            )
          })}
          {matches?.as_mentor.map((m) => {
            const participantName =
              m.participant?.full_name || m.participant?.username || 'Participant'
            return (
              <li key={`mentor-${m.id}`} className={YOUTH_CARD}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <YouthAvatar src={m.participant?.avatar_url} name={participantName} />
                    <div>
                      <p className="text-sm font-medium text-content">
                        As mentor · {participantName}
                      </p>
                      <div className="mt-1">
                        <StatusBadge status={m.status} />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {m.status === 'requested' ? (
                      <>
                        <button
                          type="button"
                          className="btn-primary text-sm"
                          disabled={busy}
                          onClick={() => updateMatch(m.id, 'accept')}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          className="btn-secondary text-sm"
                          disabled={busy}
                          onClick={() => updateMatch(m.id, 'decline')}
                        >
                          Decline
                        </button>
                      </>
                    ) : null}
                    {m.status === 'active' ? (
                      <button
                        type="button"
                        className="btn-secondary text-sm"
                        disabled={busy}
                        onClick={() => updateMatch(m.id, 'complete')}
                      >
                        Complete
                      </button>
                    ) : null}
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
