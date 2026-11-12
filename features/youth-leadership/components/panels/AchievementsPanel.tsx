'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import StatusBadge from '@/features/youth-leadership/components/StatusBadge'
import EmptyState from '@/features/youth-leadership/components/EmptyState'
import YouthSkeleton from '@/features/youth-leadership/components/YouthSkeleton'
import VerifiedBadge from '@/features/youth-leadership/components/VerifiedBadge'
import YouthSectionHeader from '@/features/youth-leadership/components/YouthSectionHeader'
import YouthFormModal, {
  YOUTH_FIELD,
  YouthFieldLabel,
} from '@/features/youth-leadership/components/YouthFormModal'
import { YOUTH_CARD, YOUTH_CHIP, YOUTH_SELECT } from '@/features/youth-leadership/constants/nav'
import type {
  YouthAchievement,
  YouthAchievementType,
} from '@/shared/types/youthLeadership'

const TYPES: YouthAchievementType[] = [
  'program_completion',
  'skill',
  'course',
  'volunteer',
  'project_contribution',
  'mentorship_milestone',
  'badge',
  'certificate',
  'other',
]

const EMPTY_FORM = {
  title: '',
  description: '',
  achievement_type: 'skill' as YouthAchievementType,
  skills: '',
  certificate_url: '',
}

export default function AchievementsPanel() {
  const { user, loading: authLoading } = useAuth()
  const [items, setItems] = useState<YouthAchievement[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiClient.get<YouthAchievement[]>(
        '/api/youth-leadership/achievements',
        { status: status || undefined }
      )
      setItems(Array.isArray(data) ? data : [])
    } catch (err) {
      setItems([])
      toast.error(err instanceof ApiError ? err.message : 'Failed to load achievements')
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    if (authLoading || !user) return
    load()
  }, [authLoading, user, load])

  async function createAchievement() {
    if (!form.title.trim()) {
      toast.error('Title is required')
      return
    }
    setBusy(true)
    try {
      await apiClient.post('/api/youth-leadership/achievements', {
        title: form.title.trim(),
        description: form.description || null,
        achievement_type: form.achievement_type,
        skills: form.skills
          ? form.skills.split(',').map((s) => s.trim()).filter(Boolean)
          : null,
        certificate_url: form.certificate_url || null,
      })
      toast.success('Achievement submitted (pending verification)')
      setShowForm(false)
      setForm(EMPTY_FORM)
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create achievement')
    } finally {
      setBusy(false)
    }
  }

  function closeForm() {
    if (busy) return
    setShowForm(false)
  }

  if (authLoading) return <YouthSkeleton count={3} variant="row" />
  if (!user) return <EmptyState title="Sign in required" />

  return (
    <>
      <YouthSectionHeader
        title="Achievements & certificates"
        badge={
          !loading ? (
            <span className="rounded-full bg-surface-secondary px-2.5 py-0.5 text-xs font-medium text-content-secondary">
              {items.length} listed
            </span>
          ) : null
        }
      >
        <select
          className={`${YOUTH_SELECT} h-10`}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by verification status"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
        </select>
        <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
          Add achievement
        </button>
      </YouthSectionHeader>

      {loading ? (
        <YouthSkeleton count={3} variant="row" />
      ) : items.length === 0 ? (
        <EmptyState
          title="No achievements yet"
          description="Completed programs, verified certificates, and badges will appear here."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.id} className={YOUTH_CARD}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-content">{item.title}</h3>
                  {item.verification_status === 'verified' ? (
                    <VerifiedBadge label="Verified" />
                  ) : (
                    <StatusBadge status={item.verification_status} />
                  )}
                </div>
                <span className={`${YOUTH_CHIP} capitalize`}>
                  {item.achievement_type.replace(/_/g, ' ')}
                </span>
              </div>
              {item.description ? (
                <p className="mt-3 text-sm leading-relaxed text-content-secondary">
                  {item.description}
                </p>
              ) : null}
              {item.skills?.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {item.skills.map((skill) => (
                    <span key={skill} className={YOUTH_CHIP}>
                      {skill}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                {item.certificate_url ? (
                  <a
                    href={item.certificate_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-primary"
                  >
                    View certificate →
                  </a>
                ) : (
                  <span className="text-xs text-content-tertiary">No certificate link</span>
                )}
                {item.verification_status === 'verified' && item.verified_at ? (
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    Verified {new Date(item.verified_at).toLocaleDateString()}
                  </p>
                ) : item.verification_status === 'pending' ? (
                  <p className="text-xs text-content-tertiary">Awaiting verification</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <YouthFormModal
        open={showForm}
        title="Submit achievement"
        onClose={closeForm}
        size="md"
        footer={
          <>
            <button type="button" className="btn-secondary" disabled={busy} onClick={closeForm}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={createAchievement}
            >
              {busy ? 'Submitting…' : 'Submit for verification'}
            </button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <YouthFieldLabel htmlFor="achievement-title">Title</YouthFieldLabel>
            <input
              id="achievement-title"
              className={YOUTH_FIELD}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
          </div>
          <div>
            <YouthFieldLabel htmlFor="achievement-type">Type</YouthFieldLabel>
            <select
              id="achievement-type"
              className={YOUTH_FIELD}
              value={form.achievement_type}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  achievement_type: e.target.value as YouthAchievementType,
                }))
              }
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <YouthFieldLabel htmlFor="achievement-skills">
              Skills (comma-separated)
            </YouthFieldLabel>
            <input
              id="achievement-skills"
              className={YOUTH_FIELD}
              value={form.skills}
              onChange={(e) => setForm((f) => ({ ...f, skills: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <YouthFieldLabel htmlFor="achievement-description">Description</YouthFieldLabel>
            <textarea
              id="achievement-description"
              className={`${YOUTH_FIELD} min-h-[72px]`}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <YouthFieldLabel htmlFor="achievement-cert">
              Certificate URL (optional)
            </YouthFieldLabel>
            <input
              id="achievement-cert"
              className={YOUTH_FIELD}
              value={form.certificate_url}
              onChange={(e) => setForm((f) => ({ ...f, certificate_url: e.target.value }))}
              placeholder="https://"
            />
          </div>
        </div>
      </YouthFormModal>
    </>
  )
}
