'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import YouthShell from '@/features/youth-leadership/components/YouthShell'
import StatusBadge from '@/features/youth-leadership/components/StatusBadge'
import EmptyState from '@/features/youth-leadership/components/EmptyState'
import YouthFormModal, {
  YOUTH_FIELD,
  YouthFieldLabel,
} from '@/features/youth-leadership/components/YouthFormModal'
import { YOUTH_CARD } from '@/features/youth-leadership/constants/nav'
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

export default function YouthAchievementsPage() {
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

  return (
    <YouthShell
      title="My Achievements"
      subtitle="Certificates and badges. Participants cannot self-verify — coordinators or admins confirm them."
      actions={
        <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
          Add achievement
        </button>
      }
    >
      {authLoading || loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`${YOUTH_CARD} h-24 animate-pulse bg-surface-secondary`} />
          ))}
        </div>
      ) : !user ? (
        <EmptyState title="Sign in required" />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <select
              className="rounded-lg border border-border bg-surface-primary px-3 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All verification statuses</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {items.length === 0 ? (
            <EmptyState
              title="No achievements yet"
              description="Completed programs, verified certificates, and badges will appear here."
            />
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <li key={item.id} className={YOUTH_CARD}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-content-primary">{item.title}</h3>
                        <StatusBadge status={item.verification_status} />
                      </div>
                      <p className="mt-1 text-xs capitalize text-content-tertiary">
                        {item.achievement_type.replace(/_/g, ' ')}
                      </p>
                      {item.description ? (
                        <p className="mt-2 text-sm text-content-secondary">
                          {item.description}
                        </p>
                      ) : null}
                      {item.skills?.length ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {item.skills.map((skill) => (
                            <span
                              key={skill}
                              className="rounded-md bg-surface-secondary px-2 py-0.5 text-xs text-content-secondary"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {item.certificate_url ? (
                        <a
                          href={item.certificate_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block text-sm font-medium text-primary"
                        >
                          View certificate
                        </a>
                      ) : null}
                      {item.verification_status === 'verified' && item.verified_at ? (
                        <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
                          Verified {new Date(item.verified_at).toLocaleDateString()}
                        </p>
                      ) : item.verification_status === 'pending' ? (
                        <p className="mt-2 text-xs text-content-tertiary">
                          Awaiting coordinator or admin verification
                        </p>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <YouthFormModal
        open={showForm}
        title="Submit achievement"
        description="Your submission stays pending until an organization coordinator or platform admin verifies it. Verification badges cannot be granted by participants."
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
    </YouthShell>
  )
}
