'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import EmptyState from '@/features/youth-leadership/components/EmptyState'
import StatusBadge from '@/features/youth-leadership/components/StatusBadge'
import YouthSkeleton from '@/features/youth-leadership/components/YouthSkeleton'
import YouthSectionHeader from '@/features/youth-leadership/components/YouthSectionHeader'
import {
  YOUTH_CARD,
  YOUTH_CARD_INTERACTIVE,
  YOUTH_CHIP,
  YOUTH_SECTION_TITLE,
} from '@/features/youth-leadership/constants/nav'
import type { YouthDashboardSummary } from '@/shared/types/youthLeadership'

export default function DashboardPanel() {
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
  }, [authLoading, user?.id, load])

  const cards = summary
    ? [
        {
          label: 'Active programs',
          value: summary.active_programs,
          href: '/youth-leadership?tab=enrolled',
        },
        {
          label: 'Applications',
          value: summary.applications,
          href: '/youth-leadership?tab=applications',
        },
        {
          label: 'Upcoming events',
          value: summary.upcoming_events,
          href: '/youth-leadership/community?tab=events',
        },
        {
          label: 'Current projects',
          value: summary.current_projects,
          href: '/youth-leadership/community?tab=projects',
        },
        {
          label: 'Mentorships',
          value: summary.mentorships,
          href: '/youth-leadership/mentorship?tab=matches',
        },
        {
          label: 'Achievements',
          value: summary.achievements,
          href: '/youth-leadership/progress?tab=achievements',
        },
        {
          label: 'Certificates',
          value: summary.certificates,
          href: '/youth-leadership/progress?tab=achievements',
        },
        {
          label: 'Programs completed',
          value: summary.programs_completed,
          href: '/youth-leadership?tab=enrolled',
        },
        {
          label: 'Projects completed',
          value: summary.projects_completed,
          href: '/youth-leadership/community?tab=projects',
        },
      ]
    : []

  if (authLoading || loading) return <YouthSkeleton count={6} variant="stat" />
  if (!user) return <EmptyState title="Sign in required" />
  if (!summary) {
    return <EmptyState title="Dashboard unavailable" description="Try refreshing the page." />
  }

  return (
    <>
      <YouthSectionHeader title="Your progress overview" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className={YOUTH_CARD_INTERACTIVE}>
            <p className="text-xs font-medium text-content-secondary">{card.label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-content">
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
              <span key={skill} className={YOUTH_CHIP}>
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
                    className="text-sm font-medium text-content hover:text-primary"
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
                    <p className="text-sm font-medium text-content">{e.title}</p>
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
                    <p className="text-sm font-medium text-content">{t.title}</p>
                    <div className="mt-1">
                      <StatusBadge status={t.status} />
                    </div>
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
                    href="/youth-leadership/mentorship?tab=matches"
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
  )
}
