'use client'

import Link from 'next/link'
import type { LucideIcon } from '@/shared/icons'

export default function GschStatCard({
  label,
  value,
  icon: Icon,
  hint,
  href,
}: {
  label: string
  value: React.ReactNode
  icon?: LucideIcon
  hint?: string
  href?: string
}) {
  const cardClass =
    'rounded-2xl border border-border/80 bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]'

  const content = (
    <>
      {Icon ? (
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </span>
      ) : null}
      <p className="mt-3 text-[11px] font-medium uppercase leading-snug tracking-wide text-content-tertiary">
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-content">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-content-tertiary">{hint}</p> : null}
    </>
  )

  if (href) {
    return (
      <Link
        href={href}
        className={`${cardClass} block transition hover:border-primary/30 hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30`}
      >
        {content}
      </Link>
    )
  }

  return <div className={cardClass}>{content}</div>
}
