'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
} from '@/features/youth-leadership/constants/nav'
import {
  BookOpen,
  Calendar,
  Chart,
  CheckCircle2,
  Clock,
  Sparkles,
  Target,
  Users,
  type LucideIcon,
} from '@/shared/icons'
import type { YouthDashboardSummary } from '@/shared/types/youthLeadership'

function pct(done: number, active: number) {
  const total = done + active
  if (total <= 0) return 0
  return Math.round((done / total) * 100)
}

function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div
      className={`h-2 overflow-hidden rounded-full bg-surface-secondary ${className}`}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

function BoardColumn({
  title,
  count,
  icon: Icon,
  iconClass,
  empty,
  children,
}: {
  title: string
  count: number
  icon: LucideIcon
  iconClass: string
  empty: string
  children: React.ReactNode
}) {
  return (
    <section
      className="flex min-h-[16rem] flex-col rounded-2xl bg-surface-secondary/80"
      aria-label={`${title} column`}
    >
      <header className="flex items-center gap-2 px-3 pb-2 pt-3">
        <Icon className={`h-4 w-4 shrink-0 ${iconClass}`} aria-hidden />
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-content">
          {title}{' '}
          <span className="font-medium text-content-tertiary">({count})</span>
        </h3>
      </header>
      <ul className="flex min-h-[8rem] flex-1 flex-col gap-2 overflow-y-auto px-2.5 pb-3">
        {count === 0 ? (
          <li className="rounded-xl border border-dashed border-border/70 px-3 py-8 text-center text-xs text-content-tertiary">
            {empty}
          </li>
        ) : (
          children
        )}
      </ul>
    </section>
  )
}

function BoardItem({
  title,
  meta,
  href,
  badge,
}: {
  title: string
  meta?: string
  href?: string
  badge?: React.ReactNode
}) {
  const body = (
    <>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-content">{title}</p>
        {meta ? <p className="mt-0.5 text-xs text-content-tertiary">{meta}</p> : null}
      </div>
      {badge}
    </>
  )

  if (href) {
    return (
      <li>
        <Link
          href={href}
          className="flex items-start justify-between gap-2 rounded-xl border border-border/60 bg-surface px-3 py-2.5 transition hover:border-primary/30 hover:bg-surface-secondary/40"
        >
          {body}
        </Link>
      </li>
    )
  }

  return (
    <li className="flex items-start justify-between gap-2 rounded-xl border border-border/60 bg-surface px-3 py-2.5">
      {body}
    </li>
  )
}

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

  const programPct = useMemo(
    () => (summary ? pct(summary.programs_completed, summary.active_programs) : 0),
    [summary]
  )
  const projectPct = useMemo(
    () => (summary ? pct(summary.projects_completed, summary.current_projects) : 0),
    [summary]
  )
  const overallPct = useMemo(() => {
    if (!summary) return 0
    const programTotal = summary.programs_completed + summary.active_programs
    const projectTotal = summary.projects_completed + summary.current_projects
    const total = programTotal + projectTotal
    if (total <= 0) return summary.achievements > 0 ? 100 : 0
    return Math.round(
      ((summary.programs_completed + summary.projects_completed) / total) * 100
    )
  }, [summary])

  const openTasks = summary?.upcoming.tasks.length ?? 0

  const metrics = summary
    ? [
        {
          label: 'Active programs',
          value: summary.active_programs,
          href: '/youth-leadership?tab=enrolled',
          icon: BookOpen,
        },
        {
          label: 'Current projects',
          value: summary.current_projects,
          href: '/youth-leadership/community?tab=projects',
          icon: Target,
        },
        {
          label: 'Open tasks',
          value: openTasks,
          href: '/youth-leadership/community?tab=projects',
          icon: Clock,
        },
        {
          label: 'Mentorships',
          value: summary.mentorships,
          href: '/youth-leadership/mentorship?tab=matches',
          icon: Users,
        },
        {
          label: 'Achievements',
          value: summary.achievements,
          href: '/youth-leadership/progress?tab=achievements',
          icon: Sparkles,
        },
        {
          label: 'Certificates',
          value: summary.certificates,
          href: '/youth-leadership/progress?tab=achievements',
          icon: CheckCircle2,
        },
      ]
    : []

  if (authLoading || loading) return <YouthSkeleton variant="dashboard" />
  if (!user) return <EmptyState title="Sign in required" />
  if (!summary) {
    return <EmptyState title="Dashboard unavailable" description="Try refreshing the page." />
  }

  return (
    <>
      <YouthSectionHeader
        title="Progress board"
        badge={
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            {overallPct}% complete
          </span>
        }
      >
        <Link
          href="/youth-leadership/progress?tab=achievements"
          className="text-sm font-medium text-primary hover:underline"
        >
          View achievements
        </Link>
      </YouthSectionHeader>

      <section className={YOUTH_CARD}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Chart className="h-4 w-4 text-primary" aria-hidden />
              <p className="text-sm font-medium text-content">Overall completion</p>
            </div>
            <p className="mt-1 text-xs text-content-secondary">
              Based on finished vs active programs and projects.
            </p>
          </div>
          <p className="text-3xl font-semibold tabular-nums tracking-tight text-content">
            {overallPct}%
          </p>
        </div>

        <ProgressBar value={overallPct} className="mt-4" />

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-content-secondary">Programs</span>
              <span className="tabular-nums text-content-tertiary">
                {summary.programs_completed} done · {summary.active_programs} active
              </span>
            </div>
            <ProgressBar value={programPct} className="mt-2" />
          </div>
          <div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-content-secondary">Projects</span>
              <span className="tabular-nums text-content-tertiary">
                {summary.projects_completed} done · {summary.current_projects} active
              </span>
            </div>
            <ProgressBar value={projectPct} className="mt-2" />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-border/70 pt-4 text-xs text-content-secondary">
          <span className={YOUTH_CHIP}>{summary.applications} applications</span>
          <span className={YOUTH_CHIP}>{summary.upcoming_events} upcoming events</span>
          <span className={YOUTH_CHIP}>{summary.skills.length} skills tracked</span>
        </div>
      </section>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {metrics.map((metric) => {
          const Icon = metric.icon
          return (
            <Link key={metric.label} href={metric.href} className={YOUTH_CARD_INTERACTIVE}>
              <div className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-content-tertiary" aria-hidden />
                <p className="truncate text-xs font-medium text-content-secondary">
                  {metric.label}
                </p>
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-content">
                {metric.value}
              </p>
            </Link>
          )
        })}
      </div>

      <div className="mt-8">
        <YouthSectionHeader title="Current board" />
        <div className="-mx-1 overflow-x-auto pb-1">
          <div className="flex min-w-max gap-3 px-1 sm:min-w-0 sm:grid sm:grid-cols-2 xl:grid-cols-4">
            <BoardColumn
              title="Open tasks"
              count={summary.upcoming.tasks.length}
              icon={Clock}
              iconClass="text-amber-500"
              empty="No open project tasks"
            >
              {summary.upcoming.tasks.map((t) => (
                <BoardItem
                  key={t.id}
                  title={t.title}
                  meta={
                    t.due_date
                      ? `Due ${new Date(t.due_date).toLocaleDateString()}`
                      : 'No due date'
                  }
                  badge={<StatusBadge status={t.status} />}
                />
              ))}
            </BoardColumn>

            <BoardColumn
              title="Deadlines"
              count={summary.upcoming.application_deadlines.length}
              icon={Target}
              iconClass="text-orange-500"
              empty="No deadlines in the next 30 days"
            >
              {summary.upcoming.application_deadlines.map((p) => (
                <BoardItem
                  key={p.id}
                  title={p.title}
                  href={`/youth-leadership/programs/${p.id}`}
                  meta={
                    p.application_deadline
                      ? new Date(p.application_deadline).toLocaleDateString()
                      : undefined
                  }
                />
              ))}
            </BoardColumn>

            <BoardColumn
              title="Events"
              count={summary.upcoming.events.length}
              icon={Calendar}
              iconClass="text-sky-500"
              empty="No registered events soon"
            >
              {summary.upcoming.events.map((e) => (
                <BoardItem
                  key={e.id}
                  title={e.title}
                  meta={new Date(e.start_at).toLocaleString()}
                  badge={
                    <span className="shrink-0 text-[10px] capitalize text-content-tertiary">
                      {e.event_type.replace(/_/g, ' ')}
                    </span>
                  }
                />
              ))}
            </BoardColumn>

            <BoardColumn
              title="Mentorship"
              count={summary.upcoming.mentorship_sessions.length}
              icon={Users}
              iconClass="text-emerald-500"
              empty="No active mentorship sessions"
            >
              {summary.upcoming.mentorship_sessions.map((m) => (
                <BoardItem
                  key={m.id}
                  title="Active mentorship"
                  href="/youth-leadership/mentorship?tab=matches"
                  badge={<StatusBadge status={m.status} />}
                />
              ))}
            </BoardColumn>
          </div>
        </div>
      </div>

      {summary.skills.length > 0 ? (
        <section className="mt-8">
          <YouthSectionHeader title="Skills growing" />
          <div className="flex flex-wrap gap-2">
            {summary.skills.map((skill) => (
              <span key={skill} className={YOUTH_CHIP}>
                {skill}
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </>
  )
}
