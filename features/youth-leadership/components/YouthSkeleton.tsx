'use client'

import { YOUTH_CARD } from '@/features/youth-leadership/constants/nav'

function Shimmer({ className = '' }: { className?: string }) {
  return <div className={`animate-shimmer rounded-md ${className}`} aria-hidden />
}

/** Matches ProgramCard / ProjectCard grid tiles (title-first, no avatar). */
function CardSkeleton() {
  return (
    <div className={`${YOUTH_CARD} flex h-full flex-col`}>
      <Shimmer className="h-5 w-[75%] max-w-[14rem]" />
      <Shimmer className="mt-2 h-3 w-28" />

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

/** Matches MentorsPanel cards (avatar + bio + CTA). */
function MentorSkeleton() {
  return (
    <div className={YOUTH_CARD}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <Shimmer className="h-12 w-12 shrink-0 rounded-full" />
          <div className="min-w-0 space-y-2">
            <Shimmer className="h-4 w-32" />
            <Shimmer className="h-5 w-16 rounded-full" />
          </div>
        </div>
        <Shimmer className="h-6 w-24 shrink-0 rounded-full" />
      </div>

      <div className="mt-3 space-y-2">
        <Shimmer className="h-3.5 w-full" />
        <Shimmer className="h-3.5 w-[90%]" />
        <Shimmer className="h-3.5 w-[70%]" />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Shimmer className="h-6 w-14 rounded-full" />
        <Shimmer className="h-6 w-16 rounded-full" />
        <Shimmer className="h-6 w-12 rounded-full" />
      </div>

      <Shimmer className="mt-4 h-10 w-full rounded-lg" />
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

/** Matches ApplicationsPanel / org rows with avatar + status. */
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

/** Matches guardian / mentorship rows with avatar + action buttons. */
function ActionRowSkeleton() {
  return (
    <div className={YOUTH_CARD}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Shimmer className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 space-y-2">
            <Shimmer className="h-4 w-40 max-w-full" />
            <Shimmer className="h-3.5 w-28" />
            <Shimmer className="h-5 w-16 rounded-full" />
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Shimmer className="h-9 w-20 rounded-lg" />
          <Shimmer className="h-9 w-24 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

/** Matches EventsPanel rows (title/meta + single action). */
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
        <Shimmer className="h-10 w-28 shrink-0 rounded-lg" />
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

/** Matches organization list table. */
function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shimmer className="h-5 w-40" />
          <Shimmer className="h-5 w-14 rounded-full" />
        </div>
      </div>
      <div className={`${YOUTH_CARD} overflow-hidden p-0`}>
        <div className="flex items-center gap-4 border-b border-border bg-surface-secondary/50 px-5 py-3.5">
          <Shimmer className="h-4 w-28" />
          <Shimmer className="ml-auto h-4 w-16" />
          <Shimmer className="h-4 w-14" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border/70 px-5 py-4 last:border-b-0"
          >
            <Shimmer className="h-4 w-40 max-w-[45%]" />
            <Shimmer className="ml-auto h-5 w-20 rounded-full" />
            <Shimmer className="h-9 w-9 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Program / project / org detail pages. */
function DetailSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className={YOUTH_CARD}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Shimmer className="h-6 w-56 max-w-full" />
              <Shimmer className="h-5 w-20 rounded-full" />
            </div>
            <div className="flex items-center gap-2">
              <Shimmer className="h-8 w-8 shrink-0 rounded-full" />
              <Shimmer className="h-3.5 w-36" />
            </div>
            <div className="space-y-2 pt-1">
              <Shimmer className="h-3.5 w-full" />
              <Shimmer className="h-3.5 w-full" />
              <Shimmer className="h-3.5 w-[70%]" />
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Shimmer className="h-6 w-16 rounded-full" />
              <Shimmer className="h-6 w-20 rounded-full" />
              <Shimmer className="h-6 w-14 rounded-full" />
            </div>
          </div>
          <Shimmer className="h-10 w-28 shrink-0 rounded-lg" />
        </div>
        <div className="mt-5 space-y-2 border-t border-border pt-4">
          <div className="flex justify-between gap-2">
            <Shimmer className="h-3 w-24" />
            <Shimmer className="h-3 w-16" />
          </div>
          <Shimmer className="h-2 w-full rounded-full" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatSkeleton key={i} />
        ))}
      </div>

      <div className={YOUTH_CARD}>
        <Shimmer className="mb-3 h-4 w-28" />
        <div className="space-y-2">
          <Shimmer className="h-3.5 w-full" />
          <Shimmer className="h-3.5 w-full" />
          <Shimmer className="h-3.5 w-[60%]" />
        </div>
      </div>
    </div>
  )
}

/** Progress overview: completion card + metric tiles + board. */
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
            <div className="flex items-center gap-2">
              <Shimmer className="h-4 w-4 rounded" />
              <Shimmer className="h-4 w-36" />
            </div>
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
        <div className="-mx-1 overflow-x-auto pb-1">
          <div className="flex min-w-max gap-3 px-1 sm:min-w-0 sm:grid sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex min-h-[16rem] w-64 flex-col rounded-2xl bg-surface-secondary/80 sm:w-auto"
              >
                <div className="flex items-center gap-2 px-3 pb-2 pt-3">
                  <Shimmer className="h-4 w-4 rounded" />
                  <Shimmer className="h-4 w-24" />
                </div>
                <div className="flex flex-1 flex-col gap-2 px-2.5 pb-3">
                  <Shimmer className="h-14 w-full rounded-xl" />
                  <Shimmer className="h-14 w-full rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export type YouthSkeletonVariant =
  | 'card'
  | 'row'
  | 'action'
  | 'stat'
  | 'achievement'
  | 'dashboard'
  | 'event'
  | 'mentor'
  | 'table'
  | 'detail'

export default function YouthSkeleton({
  count = 3,
  variant = 'card',
  className = '',
}: {
  count?: number
  variant?: YouthSkeletonVariant
  className?: string
}) {
  if (variant === 'dashboard') return <DashboardSkeleton />
  if (variant === 'detail') return <DetailSkeleton />
  if (variant === 'table') return <TableSkeleton rows={count} />

  const layout =
    variant === 'row' || variant === 'event' || variant === 'action'
      ? `space-y-3 ${className}`
      : variant === 'achievement' || variant === 'mentor'
        ? `grid gap-3 sm:grid-cols-2 ${className}`
        : `grid gap-4 sm:grid-cols-2 ${
            variant === 'stat' ? 'lg:grid-cols-3 xl:grid-cols-6 gap-3' : 'xl:grid-cols-3'
          } ${className}`

  const Item =
    variant === 'row'
      ? RowSkeleton
      : variant === 'action'
        ? ActionRowSkeleton
        : variant === 'event'
          ? EventSkeleton
          : variant === 'stat'
            ? StatSkeleton
            : variant === 'achievement'
              ? AchievementSkeleton
              : variant === 'mentor'
                ? MentorSkeleton
                : CardSkeleton

  return (
    <div className={layout} aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <Item key={i} />
      ))}
    </div>
  )
}
