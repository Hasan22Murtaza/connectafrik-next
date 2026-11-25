'use client'

import { SlidersHorizontal } from '@/shared/icons'

export function countActiveFilters(
  values: Record<string, string | number | boolean | null | undefined>
): number {
  return Object.values(values).filter((value) => {
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value !== 0
    return String(value ?? '').trim().length > 0
  }).length
}

export default function GschFiltersButton({
  activeCount = 0,
  onClick,
}: {
  activeCount?: number
  onClick: () => void
}) {
  return (
    <button type="button" className="btn-secondary inline-flex items-center gap-2 text-sm" onClick={onClick}>
      <SlidersHorizontal className="h-4 w-4" aria-hidden />
      Filters
      {activeCount > 0 ? (
        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
          {activeCount}
        </span>
      ) : null}
    </button>
  )
}
