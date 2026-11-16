'use client'

import { ShieldCheck } from '@/shared/icons'

export default function VerifiedBadge({
  label = 'Verified',
  compact = false,
  className = '',
}: {
  label?: string
  compact?: boolean
  className?: string
}) {
  if (compact) {
    return (
      <span
        title={label}
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ${className}`}
        aria-label={label}
      >
        <ShieldCheck className="h-3 w-3" aria-hidden />
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:text-emerald-200 ${className}`}
    >
      <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {label}
    </span>
  )
}
