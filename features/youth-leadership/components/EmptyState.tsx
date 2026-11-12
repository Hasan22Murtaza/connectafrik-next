'use client'

import type { LucideIcon } from '@/shared/icons'
import { Inbox } from '@/shared/icons'

export default function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  icon?: LucideIcon
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border/90 bg-surface/70 px-6 py-16 text-center">
      <div
        className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10"
        aria-hidden
      >
        <Icon className="h-5 w-5 text-primary" strokeWidth={1.75} />
      </div>
      <h3 className="text-base font-semibold text-content">{title}</h3>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-content-secondary">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  )
}
