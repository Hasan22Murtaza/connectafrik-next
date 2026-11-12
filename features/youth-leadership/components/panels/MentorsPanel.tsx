'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Search } from '@/shared/icons'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import StatusBadge from '@/features/youth-leadership/components/StatusBadge'
import EmptyState from '@/features/youth-leadership/components/EmptyState'
import VerifiedBadge from '@/features/youth-leadership/components/VerifiedBadge'
import YouthSkeleton from '@/features/youth-leadership/components/YouthSkeleton'
import YouthSectionHeader from '@/features/youth-leadership/components/YouthSectionHeader'
import YouthFormModal, {
  YOUTH_FIELD,
  YouthFieldLabel,
} from '@/features/youth-leadership/components/YouthFormModal'
import YouthAvatar from '@/features/youth-leadership/components/YouthAvatar'
import { YOUTH_CARD, YOUTH_CHIP } from '@/features/youth-leadership/constants/nav'
import type { YouthMentor } from '@/shared/types/youthLeadership'

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

export default function MentorsPanel() {
  const { user, loading: authLoading } = useAuth()
  const [mentors, setMentors] = useState<YouthMentor[]>([])
  const [myMentor, setMyMentor] = useState<YouthMentor | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [showMentorForm, setShowMentorForm] = useState(false)
  const [mentorForm, setMentorForm] = useState(EMPTY_MENTOR_FORM)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [mentorList, mine] = await Promise.all([
        apiClient.get<YouthMentor[]>('/api/youth-leadership/mentors', {
          search: search || undefined,
        }),
        apiClient.get<YouthMentor[]>('/api/youth-leadership/mentors', { mine: 1 }),
      ])
      setMentors(Array.isArray(mentorList) ? mentorList : [])
      const mineFirst = Array.isArray(mine) && mine[0] ? mine[0] : null
      setMyMentor(mineFirst)
      if (mineFirst) {
        setMentorForm({
          bio: mineFirst.bio || '',
          experience_summary: mineFirst.experience_summary || '',
          expertise: (mineFirst.expertise || []).join(', '),
          skills: (mineFirst.skills || []).join(', '),
          languages: (mineFirst.languages || []).join(', '),
          mentorship_interests: (mineFirst.mentorship_interests || []).join(', '),
          accepts_minors: Boolean(mineFirst.accepts_minors),
        })
      }
    } catch (err) {
      setMentors([])
      toast.error(err instanceof ApiError ? err.message : 'Failed to load mentors')
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
      toast.success(
        myMentor ? 'Mentor profile updated' : 'Mentor profile submitted for verification'
      )
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

  if (authLoading) return <YouthSkeleton count={4} />
  if (!user) return <EmptyState title="Sign in required" />

  return (
    <>
      <YouthSectionHeader
        title="Verified mentors"
        badge={
          !loading ? (
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              {mentors.length} available
            </span>
          ) : null
        }
      >
        <button
          type="button"
          className="btn-secondary h-10"
          onClick={() => setShowMentorForm(true)}
        >
          {myMentor ? 'Edit mentor profile' : 'Become a mentor'}
        </button>
      </YouthSectionHeader>

      <form
        className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center"
        onSubmit={(e) => {
          e.preventDefault()
          setSearch(searchInput.trim())
        }}
      >
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search mentors</span>
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-tertiary"
            aria-hidden
          />
          <input
            className={`${YOUTH_FIELD} h-11 rounded-xl border-border/80 bg-surface pl-10 shadow-[0_1px_2px_rgba(15,23,42,0.04)]`}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search mentors by name, skill, or expertise…"
          />
        </label>
        <button type="submit" className="btn-primary h-11 shrink-0 px-5">
          Search
        </button>
      </form>

      {loading ? (
        <YouthSkeleton count={4} />
      ) : mentors.length === 0 ? (
        <EmptyState
          title="No verified mentors yet"
          description="Check back after mentors are verified by platform admins."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {mentors.map((mentor) => {
            const mentorName =
              mentor.profile?.full_name || mentor.profile?.username || 'Mentor'
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
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="font-semibold text-content">{mentorName}</h3>
                        {mentor.verification_status === 'verified' ? (
                          <VerifiedBadge compact label="Verified mentor" />
                        ) : null}
                      </div>
                      <div className="mt-1">
                        <StatusBadge status={mentor.verification_status} />
                      </div>
                    </div>
                  </div>
                  {mentor.accepts_minors ? (
                    <span className={YOUTH_CHIP}>Accepts minors</span>
                  ) : null}
                </div>
                {mentor.bio ? (
                  <p className="mt-2 line-clamp-3 text-sm text-content-secondary">
                    {mentor.bio}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-1">
                  {(mentor.expertise || []).slice(0, 6).map((tag) => (
                    <span key={tag} className={YOUTH_CHIP}>
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

      <YouthFormModal
        open={showMentorForm}
        title={myMentor ? 'Edit mentor profile' : 'Become a mentor'}
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
    </>
  )
}
