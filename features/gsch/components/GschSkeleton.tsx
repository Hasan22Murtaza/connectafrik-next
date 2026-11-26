'use client'

import { GSCH_CARD } from '@/features/gsch/constants/styles'

function Shimmer({ className = '' }: { className?: string }) {
  return <div className={`animate-shimmer rounded-md ${className}`} aria-hidden />
}

function CardSkeleton() {
  return (
    <div className={`${GSCH_CARD} flex h-full flex-col`}>
      <Shimmer className="mb-3 h-28 w-full rounded-xl" />
      <Shimmer className="h-5 w-[70%] max-w-[14rem]" />
      <Shimmer className="mt-2 h-3 w-28" />
      <div className="mt-3 space-y-2">
        <Shimmer className="h-3.5 w-full" />
        <Shimmer className="h-3.5 w-[80%]" />
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        <Shimmer className="h-6 w-16 rounded-full" />
        <Shimmer className="h-6 w-14 rounded-full" />
      </div>
    </div>
  )
}

function StatSkeleton() {
  return (
    <div className={GSCH_CARD}>
      <div className="flex items-center gap-2">
        <Shimmer className="h-7 w-7 rounded-lg" />
        <Shimmer className="h-3 w-20" />
      </div>
      <Shimmer className="mt-3 h-7 w-14" />
    </div>
  )
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shimmer className="h-5 w-40" />
          <Shimmer className="h-5 w-14 rounded-full" />
        </div>
        <div className="flex gap-2">
          <Shimmer className="h-9 w-24 rounded-lg" />
          <Shimmer className="h-9 w-20 rounded-lg" />
        </div>
      </div>
      <div className={`${GSCH_CARD} overflow-hidden p-0`}>
        <div className="flex items-center gap-4 border-b border-border bg-surface-secondary/50 px-5 py-3.5">
          <Shimmer className="h-4 w-28" />
          <Shimmer className="h-4 w-20" />
          <Shimmer className="ml-auto h-4 w-16" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border/70 px-5 py-4 last:border-b-0"
          >
            <Shimmer className="h-4 w-40 max-w-[40%]" />
            <Shimmer className="h-4 w-24" />
            <Shimmer className="ml-auto h-5 w-20 rounded-full" />
            <Shimmer className="h-9 w-9 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className={`${GSCH_CARD} space-y-3`}>
        <Shimmer className="h-6 w-56 max-w-full" />
        <Shimmer className="h-3.5 w-full max-w-xl" />
        <div className="flex flex-wrap gap-2 pt-1">
          <Shimmer className="h-9 w-36 rounded-lg" />
          <Shimmer className="h-9 w-28 rounded-lg" />
          <Shimmer className="h-9 w-32 rounded-lg" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <StatSkeleton key={i} />
        ))}
      </div>
      <div className={`${GSCH_CARD} overflow-hidden p-0`}>
        <Shimmer className="h-64 w-full rounded-none sm:h-80" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className={GSCH_CARD}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-3">
            <Shimmer className="h-6 w-56 max-w-full" />
            <Shimmer className="h-3.5 w-40" />
            <div className="space-y-2 pt-1">
              <Shimmer className="h-3.5 w-full" />
              <Shimmer className="h-3.5 w-[70%]" />
            </div>
          </div>
          <Shimmer className="h-10 w-28 shrink-0 rounded-lg" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

export type GschSkeletonVariant =
  | 'card'
  | 'stat'
  | 'table'
  | 'dashboard'
  | 'detail'

export default function GschSkeleton({
  count = 3,
  variant = 'card',
  className = '',
}: {
  count?: number
  variant?: GschSkeletonVariant
  className?: string
}) {
  if (variant === 'dashboard') return <DashboardSkeleton />
  if (variant === 'detail') return <DetailSkeleton />
  if (variant === 'table') return <TableSkeleton rows={count} />

  const layout =
    variant === 'stat'
      ? `grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 ${className}`
      : `grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${className}`

  const Item = variant === 'stat' ? StatSkeleton : CardSkeleton

  return (
    <div className={layout} aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <Item key={i} />
      ))}
    </div>
  )
}
