'use client'

import { YOUTH_CARD } from '@/features/youth-leadership/constants/nav'

function Shimmer({ className = '' }: { className?: string }) {
  return <div className={`animate-shimmer rounded-md ${className}`} aria-hidden />
}

/** Matches ProgramCard / ProjectCard grid tiles. */
function CardSkeleton() {
  return (
    <div className={`${YOUTH_CARD} flex h-full flex-col`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Shimmer className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 space-y-2 pt-0.5">
            <Shimmer className="h-3.5 w-28" />
            <Shimmer className="h-3 w-20" />
          </div>
        </div>
        <Shimmer className="h-5 w-16 shrink-0 rounded-full" />
      </div>

      <Shimmer className="mt-4 h-5 w-[80%] max-w-[14rem]" />
      <div className="mt-3 space-y-2">
        <Shimmer className="h-3.5 w-full" />
        <Shimmer className="h-3.5 w-[83%]" />
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <Shimmer className="h-6 w-16 rounded-full" />
        <Shimmer className="h-6 w-14 rounded-full" />
        <Shimmer className="h-6 w-20 rounded-full" />
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Shimmer className="h-3 w-20" />
          <Shimmer className="h-3 w-16" />
        </div>
        <Shimmer className="h-1.5 w-full rounded-full" />
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3 mt-4">
        <Shimmer className="h-3 w-28" />
        <Shimmer className="h-3 w-20" />
      </div>
    </div>
  )
}

/** Matches AchievementsPanel cards (title + status + type + body + footer). */
function AchievementSkeleton() {
  return (
    <div className={YOUTH_CARD}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Shimmer className="h-4 w-36 max-w-full" />
          <Shimmer className="h-5 w-16 rounded-full" />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Shimmer className="h-5 w-14 rounded-full" />
          <Shimmer className="h-8 w-8 rounded-lg" />
          <Shimmer className="h-8 w-8 rounded-lg" />
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <Shimmer className="h-3.5 w-full" />
        <Shimmer className="h-3.5 w-[70%]" />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Shimmer className="h-6 w-12 rounded-full" />
        <Shimmer className="h-6 w-14 rounded-full" />
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
        <Shimmer className="h-3.5 w-28" />
        <Shimmer className="h-3 w-24" />
      </div>
    </div>
  )
}

function RowSkeleton() {
  return (
    <div className={YOUTH_CARD}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Shimmer className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Shimmer className="h-3 w-24" />
            <Shimmer className="h-4 w-48 max-w-full" />
            <Shimmer className="h-3 w-36 max-w-full" />
          </div>
        </div>
        <Shimmer className="h-5 w-20 shrink-0 rounded-full" />
      </div>
    </div>
  )
}

/** Matches EventsPanel rows (title/meta + action, no avatar). */
function EventSkeleton() {
  return (
    <div className={YOUTH_CARD}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Shimmer className="h-4 w-44 max-w-full" />
            <Shimmer className="h-5 w-16 rounded-full" />
          </div>
          <Shimmer className="h-3 w-36 max-w-full" />
          <Shimmer className="h-3.5 w-56 max-w-full" />
          <Shimmer className="h-3.5 w-[75%] max-w-full" />
          <Shimmer className="h-3 w-24" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Shimmer className="h-9 w-9 rounded-lg" />
          <Shimmer className="h-9 w-9 rounded-lg" />
          <Shimmer className="h-10 w-24 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

function StatSkeleton() {
  return (
    <div className={YOUTH_CARD}>
      <div className="flex items-center gap-2">
        <Shimmer className="h-3.5 w-3.5 rounded" />
        <Shimmer className="h-3 w-20" />
      </div>
      <Shimmer className="mt-3 h-7 w-12" />
    </div>
  )
}

/** Progress overview: completion card + metric tiles. */
function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shimmer className="h-5 w-36" />
          <Shimmer className="h-5 w-16 rounded-full" />
        </div>
        <Shimmer className="h-4 w-28" />
      </div>

      <div className={YOUTH_CARD}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <Shimmer className="h-4 w-36" />
            <Shimmer className="h-3 w-56 max-w-full" />
          </div>
          <Shimmer className="h-9 w-14" />
        </div>
        <Shimmer className="mt-4 h-2 w-full rounded-full" />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="flex justify-between gap-2">
              <Shimmer className="h-3 w-16" />
              <Shimmer className="h-3 w-24" />
            </div>
            <Shimmer className="h-2 w-full rounded-full" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between gap-2">
              <Shimmer className="h-3 w-16" />
              <Shimmer className="h-3 w-24" />
            </div>
            <Shimmer className="h-2 w-full rounded-full" />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border/70 pt-4">
          <Shimmer className="h-6 w-28 rounded-full" />
          <Shimmer className="h-6 w-32 rounded-full" />
          <Shimmer className="h-6 w-24 rounded-full" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <StatSkeleton key={i} />
        ))}
      </div>

      <div className="mt-4 space-y-3">
        <Shimmer className="h-5 w-32" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-surface-secondary/80 p-3">
              <Shimmer className="mb-3 h-4 w-24" />
              <div className="space-y-2">
                <Shimmer className="h-12 w-full rounded-xl" />
                <Shimmer className="h-12 w-full rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function YouthSkeleton({
  count = 3,
  variant = 'card',
  className = '',
}: {
  count?: number
  variant?: 'card' | 'row' | 'stat' | 'achievement' | 'dashboard' | 'event'
  className?: string
}) {
  if (variant === 'dashboard') {
    return <DashboardSkeleton />
  }

  const layout =
    variant === 'row' || variant === 'event'
      ? `space-y-3 ${className}`
      : variant === 'achievement'
        ? `grid gap-3 sm:grid-cols-2 ${className}`
        : `grid gap-4 sm:grid-cols-2 ${
            variant === 'stat' ? 'lg:grid-cols-3 xl:grid-cols-6 gap-3' : 'xl:grid-cols-3'
          } ${className}`

  const Item =
    variant === 'row'
      ? RowSkeleton
      : variant === 'event'
        ? EventSkeleton
        : variant === 'stat'
          ? StatSkeleton
          : variant === 'achievement'
            ? AchievementSkeleton
            : CardSkeleton

  return (
    <div className={layout} aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <Item key={i} />
      ))}
    </div>
  )
}
