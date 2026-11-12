'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import YouthShell from '@/features/youth-leadership/components/YouthShell'
import EmptyState from '@/features/youth-leadership/components/EmptyState'
import StatusBadge from '@/features/youth-leadership/components/StatusBadge'
import { YOUTH_CARD, YOUTH_SECTION_TITLE } from '@/features/youth-leadership/constants/nav'
import type { YouthDashboardSummary } from '@/shared/types/youthLeadership'

export default function YouthDashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const [summary, setSummary] = useState<YouthDashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiClient.get<YouthDashboardSummary>(
        '/api/youth-leadership/dashboard'
      )
      setSummary(data)
    } catch (err) {
      setSummary(null)
      toast.error(err instanceof ApiError ? err.message : 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading || !user) return
    load()
  }, [authLoading, user, load])

  const cards = summary
    ? [
        { label: 'Active programs', value: summary.active_programs, href: '/youth-leadership/programs' },
        { label: 'Applications', value: summary.applications, href: '/youth-leadership/applications' },
        { label: 'Upcoming events', value: summary.upcoming_events, href: '/youth-leadership/events' },
        { label: 'Current projects', value: summary.current_projects, href: '/youth-leadership/projects' },
        { label: 'Mentorships', value: summary.mentorships, href: '/youth-leadership/mentorship' },
        { label: 'Achievements', value: summary.achievements, href: '/youth-leadership/achievements' },
        { label: 'Certificates', value: summary.certificates, href: '/youth-leadership/achievements' },
        { label: 'Programs completed', value: summary.programs_completed, href: '/youth-leadership/programs' },
        { label: 'Projects completed', value: summary.projects_completed, href: '/youth-leadership/projects' },
      ]
    : []

  return (
    <YouthShell
      title="My Leadership Dashboard"
      subtitle="A snapshot of your programs, projects, mentorship, and upcoming deadlines."
    >
      {authLoading || loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`${YOUTH_CARD} h-24 animate-pulse bg-surface-secondary`} />
          ))}
        </div>
      ) : !user ? (
        <EmptyState title="Sign in required" />
      ) : !summary ? (
        <EmptyState title="Dashboard unavailable" description="Try refreshing the page." />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <Link key={card.label} href={card.href} className={`${YOUTH_CARD} transition hover:border-primary/40`}>
                <p className="text-xs font-medium text-content-secondary">{card.label}</p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-content-primary">
                  {card.value}
                </p>
              </Link>
            ))}
          </div>

          {summary.skills.length > 0 ? (
            <section className="mt-8">
              <h2 className={YOUTH_SECTION_TITLE}>Skills</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {summary.skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-md bg-surface-secondary px-2 py-1 text-xs text-content-secondary"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <section className={YOUTH_CARD}>
              <h2 className={YOUTH_SECTION_TITLE}>Application deadlines</h2>
              {summary.upcoming.application_deadlines.length === 0 ? (
                <p className="mt-3 text-sm text-content-secondary">No upcoming deadlines.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {summary.upcoming.application_deadlines.map((p) => (
                    <li key={p.id} className="flex items-start justify-between gap-3">
                      <Link
                        href={`/youth-leadership/programs/${p.id}`}
                        className="text-sm font-medium text-content-primary hover:text-primary"
                      >
                        {p.title}
                      </Link>
                      <span className="shrink-0 text-xs text-content-tertiary">
                        {p.application_deadline
                          ? new Date(p.application_deadline).toLocaleDateString()
                          : '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={YOUTH_CARD}>
              <h2 className={YOUTH_SECTION_TITLE}>Upcoming events</h2>
              {summary.upcoming.events.length === 0 ? (
                <p className="mt-3 text-sm text-content-secondary">No registered events soon.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {summary.upcoming.events.map((e) => (
                    <li key={e.id} className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-content-primary">{e.title}</p>
                        <p className="text-xs capitalize text-content-tertiary">
                          {e.event_type.replace(/_/g, ' ')}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-content-tertiary">
                        {new Date(e.start_at).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={YOUTH_CARD}>
              <h2 className={YOUTH_SECTION_TITLE}>Open tasks</h2>
              {summary.upcoming.tasks.length === 0 ? (
                <p className="mt-3 text-sm text-content-secondary">No open project tasks.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {summary.upcoming.tasks.map((t) => (
                    <li key={t.id} className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-content-primary">{t.title}</p>
                        <StatusBadge status={t.status} />
                      </div>
                      <span className="shrink-0 text-xs text-content-tertiary">
                        {t.due_date ? new Date(t.due_date).toLocaleDateString() : 'No due date'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={YOUTH_CARD}>
              <h2 className={YOUTH_SECTION_TITLE}>Active mentorships</h2>
              {summary.upcoming.mentorship_sessions.length === 0 ? (
                <p className="mt-3 text-sm text-content-secondary">No active mentorship sessions.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {summary.upcoming.mentorship_sessions.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-3">
                      <StatusBadge status={m.status} />
                      <Link
                        href="/youth-leadership/mentorship"
                        className="text-sm font-medium text-primary"
                      >
                        View
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </YouthShell>
  )
}
