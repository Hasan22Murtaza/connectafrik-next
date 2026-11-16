'use client'

import { YOUTH_CARD } from '@/features/youth-leadership/constants/nav'

function Shimmer({ className = '' }: { className?: string }) {
  return <div className={`animate-shimmer rounded-md ${className}`} aria-hidden />
}

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

      <Shimmer className="mt-4 h-5 w-4/5 max-w-[14rem]" />
      <div className="mt-3 space-y-2">
        <Shimmer className="h-3.5 w-full" />
        <Shimmer className="h-3.5 w-5/6" />
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

function StatSkeleton() {
  return (
    <div className={YOUTH_CARD}>
      <Shimmer className="h-3 w-24" />
      <Shimmer className="mt-3 h-8 w-16" />
    </div>
  )
}

export default function YouthSkeleton({
  count = 3,
  variant = 'card',
  className = '',
}: {
  count?: number
  variant?: 'card' | 'row' | 'stat'
  className?: string
}) {
  const layout =
    variant === 'row'
      ? `space-y-3 ${className}`
      : `grid gap-4 sm:grid-cols-2 ${
          variant === 'stat' ? 'lg:grid-cols-3 gap-3' : 'xl:grid-cols-3'
        } ${className}`

  const Item =
    variant === 'row' ? RowSkeleton : variant === 'stat' ? StatSkeleton : CardSkeleton

  return (
    <div className={layout} aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <Item key={i} />
      ))}
    </div>
  )
}
