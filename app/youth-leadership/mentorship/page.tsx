'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import YouthShell from '@/features/youth-leadership/components/YouthShell'
import StatusBadge from '@/features/youth-leadership/components/StatusBadge'
import EmptyState from '@/features/youth-leadership/components/EmptyState'
import SafetyReportButton from '@/features/youth-leadership/components/SafetyReportButton'
import YouthFormModal, {
  YOUTH_FIELD,
  YouthFieldLabel,
} from '@/features/youth-leadership/components/YouthFormModal'
import YouthAvatar from '@/features/youth-leadership/components/YouthAvatar'
import { YOUTH_CARD, YOUTH_SECTION_TITLE } from '@/features/youth-leadership/constants/nav'
import type {
  YouthMentor,
  YouthMentorshipMatch,
} from '@/shared/types/youthLeadership'

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

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

const EMPTY_MENTOR_FORM = {
  bio: '',
  experience_summary: '',
  expertise: '',
  skills: '',
  languages: '',
  mentorship_interests: '',
  accepts_minors: false,
}

export default function YouthMentorshipPage() {
  const { user, loading: authLoading } = useAuth()
  const [mentors, setMentors] = useState<YouthMentor[]>([])
  const [myMentor, setMyMentor] = useState<YouthMentor | null>(null)
  const [matches, setMatches] = useState<MentorshipPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [showMentorForm, setShowMentorForm] = useState(false)
  const [mentorForm, setMentorForm] = useState(EMPTY_MENTOR_FORM)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [mentorList, mine, matchPayload] = await Promise.all([
        apiClient.get<YouthMentor[]>('/api/youth-leadership/mentors', {
          search: search || undefined,
        }),
        apiClient.get<YouthMentor[]>('/api/youth-leadership/mentors', { mine: 1 }),
        apiClient.get<MentorshipPayload>('/api/youth-leadership/mentorship'),
      ])
      setMentors(Array.isArray(mentorList) ? mentorList : [])
      setMyMentor(Array.isArray(mine) && mine[0] ? mine[0] : null)
      setMatches(matchPayload)
      if (Array.isArray(mine) && mine[0]) {
        const m = mine[0]
        setMentorForm({
          bio: m.bio || '',
          experience_summary: m.experience_summary || '',
          expertise: (m.expertise || []).join(', '),
          skills: (m.skills || []).join(', '),
          languages: (m.languages || []).join(', '),
          mentorship_interests: (m.mentorship_interests || []).join(', '),
          accepts_minors: Boolean(m.accepts_minors),
        })
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load mentorship')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    if (authLoading || !user) return
    load()
  }, [authLoading, user, load])

  async function requestMentorship(mentorId: string) {
    setBusy(true)
    try {
      await apiClient.post('/api/youth-leadership/mentorship', { mentor_id: mentorId })
      toast.success('Mentorship requested')
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }

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

  async function saveMentorProfile() {
    setBusy(true)
    try {
      await apiClient.post('/api/youth-leadership/mentors', {
        bio: mentorForm.bio || null,
        experience_summary: mentorForm.experience_summary || null,
        expertise: splitCsv(mentorForm.expertise),
        skills: splitCsv(mentorForm.skills),
        languages: splitCsv(mentorForm.languages),
        mentorship_interests: splitCsv(mentorForm.mentorship_interests),
        accepts_minors: mentorForm.accepts_minors,
      })
      toast.success(myMentor ? 'Mentor profile updated' : 'Mentor profile submitted for verification')
      setShowMentorForm(false)
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to save mentor profile')
    } finally {
      setBusy(false)
    }
  }

  function closeMentorForm() {
    if (busy) return
    setShowMentorForm(false)
  }

  return (
    <YouthShell
      title="Mentorship"
      subtitle="Browse verified mentors, request matches, and manage your mentor profile."
      actions={
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setShowMentorForm(true)}
        >
          {myMentor ? 'Edit mentor profile' : 'Become a mentor'}
        </button>
      }
    >
      {authLoading || loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`${YOUTH_CARD} h-28 animate-pulse bg-surface-secondary`} />
          ))}
        </div>
      ) : !user ? (
        <EmptyState title="Sign in required" />
      ) : (
        <div className="space-y-6">
          <section className={YOUTH_CARD}>
            <h2 className={YOUTH_SECTION_TITLE}>My matches</h2>
            {!matches ||
            (matches.as_participant.length === 0 && matches.as_mentor.length === 0) ? (
              <p className="mt-3 text-sm text-content-secondary">No mentorship matches yet.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {matches.as_participant.map((m) => {
                  const mentorName =
                    m.mentor?.profile?.full_name ||
                    m.mentor?.profile?.username ||
                    'Mentor'
                  return (
                  <div
                    key={m.id}
                    className="flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <YouthAvatar
                        src={m.mentor?.profile?.avatar_url}
                        name={mentorName}
                      />
                      <div>
                        <p className="text-sm font-medium text-content-primary">
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
                  )
                })}
                {matches.as_mentor.map((m) => {
                  const participantName =
                    m.participant?.full_name ||
                    m.participant?.username ||
                    'Participant'
                  return (
                  <div
                    key={`mentor-${m.id}`}
                    className="flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <YouthAvatar
                        src={m.participant?.avatar_url}
                        name={participantName}
                      />
                      <div>
                        <p className="text-sm font-medium text-content-primary">
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
                  )
                })}
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <h2 className={YOUTH_SECTION_TITLE}>Verified mentors</h2>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  setSearch(searchInput.trim())
                }}
              >
                <input
                  className={YOUTH_FIELD}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search mentors"
                />
                <button type="submit" className="btn-secondary shrink-0">
                  Search
                </button>
              </form>
            </div>
            {mentors.length === 0 ? (
              <EmptyState
                title="No verified mentors yet"
                description="Check back after mentors are verified by platform admins."
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {mentors.map((mentor) => {
                  const mentorName =
                    mentor.profile?.full_name ||
                    mentor.profile?.username ||
                    'Mentor'
                  return (
                  <article key={mentor.id} className={YOUTH_CARD}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <YouthAvatar
                          src={mentor.profile?.avatar_url}
                          name={mentorName}
                          size="lg"
                        />
                        <div className="min-w-0">
                          <h3 className="font-semibold text-content-primary">
                            {mentorName}
                          </h3>
                          <div className="mt-1">
                            <StatusBadge status={mentor.verification_status} />
                          </div>
                        </div>
                      </div>
                      {mentor.accepts_minors ? (
                        <span className="rounded-md bg-surface-secondary px-2 py-1 text-xs text-content-secondary">
                          Accepts minors
                        </span>
                      ) : null}
                    </div>
                    {mentor.bio ? (
                      <p className="mt-2 line-clamp-3 text-sm text-content-secondary">
                        {mentor.bio}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-1">
                      {(mentor.expertise || []).slice(0, 6).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md bg-surface-secondary px-2 py-0.5 text-xs text-content-secondary"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    {mentor.user_id !== user.id ? (
                      <button
                        type="button"
                        className="btn-primary mt-4 w-full"
                        disabled={busy}
                        onClick={() => requestMentorship(mentor.id)}
                      >
                        Request mentorship
                      </button>
                    ) : (
                      <p className="mt-4 text-xs text-content-tertiary">This is your profile.</p>
                    )}
                  </article>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      )}

      <YouthFormModal
        open={showMentorForm}
        title={myMentor ? 'Edit mentor profile' : 'Become a mentor'}
        description="New profiles start as pending until platform verification. You cannot self-verify."
        onClose={closeMentorForm}
        footer={
          <>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={closeMentorForm}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={saveMentorProfile}
            >
              {busy ? 'Saving…' : 'Save profile'}
            </button>
          </>
        }
      >
        {myMentor ? (
          <div className="mb-3">
            <StatusBadge status={myMentor.verification_status} />
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <YouthFieldLabel htmlFor="mentor-bio">Bio</YouthFieldLabel>
            <textarea
              id="mentor-bio"
              className={`${YOUTH_FIELD} min-h-[88px]`}
              value={mentorForm.bio}
              onChange={(e) => setMentorForm((f) => ({ ...f, bio: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <YouthFieldLabel htmlFor="mentor-experience">Experience summary</YouthFieldLabel>
            <textarea
              id="mentor-experience"
              className={`${YOUTH_FIELD} min-h-[72px]`}
              value={mentorForm.experience_summary}
              onChange={(e) =>
                setMentorForm((f) => ({ ...f, experience_summary: e.target.value }))
              }
            />
          </div>
          <div>
            <YouthFieldLabel htmlFor="mentor-expertise">
              Expertise (comma-separated)
            </YouthFieldLabel>
            <input
              id="mentor-expertise"
              className={YOUTH_FIELD}
              value={mentorForm.expertise}
              onChange={(e) => setMentorForm((f) => ({ ...f, expertise: e.target.value }))}
            />
          </div>
          <div>
            <YouthFieldLabel htmlFor="mentor-skills">Skills (comma-separated)</YouthFieldLabel>
            <input
              id="mentor-skills"
              className={YOUTH_FIELD}
              value={mentorForm.skills}
              onChange={(e) => setMentorForm((f) => ({ ...f, skills: e.target.value }))}
            />
          </div>
          <div>
            <YouthFieldLabel htmlFor="mentor-languages">Languages</YouthFieldLabel>
            <input
              id="mentor-languages"
              className={YOUTH_FIELD}
              value={mentorForm.languages}
              onChange={(e) => setMentorForm((f) => ({ ...f, languages: e.target.value }))}
            />
          </div>
          <div>
            <YouthFieldLabel htmlFor="mentor-interests">Mentorship interests</YouthFieldLabel>
            <input
              id="mentor-interests"
              className={YOUTH_FIELD}
              value={mentorForm.mentorship_interests}
              onChange={(e) =>
                setMentorForm((f) => ({
                  ...f,
                  mentorship_interests: e.target.value,
                }))
              }
            />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={mentorForm.accepts_minors}
              onChange={(e) =>
                setMentorForm((f) => ({ ...f, accepts_minors: e.target.checked }))
              }
            />
            Accepts mentees under 18 (with guardian approval)
          </label>
        </div>
      </YouthFormModal>
    </YouthShell>
  )
}
