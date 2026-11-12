'use client'

import Link from 'next/link'
import type { YouthProgram } from '@/shared/types/youthLeadership'
import { YOUTH_CARD } from '@/features/youth-leadership/constants/nav'
import StatusBadge from './StatusBadge'
import YouthAvatar from './YouthAvatar'

export default function ProgramCard({ program }: { program: YouthProgram }) {
  const seatsLeft =
    program.capacity == null
      ? null
      : Math.max(program.capacity - (program.seats_taken || 0), 0)

  return (
    <Link
      href={`/youth-leadership/programs/${program.id}`}
      className={`${YOUTH_CARD} group block h-full transition duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <YouthAvatar
            src={program.organization?.logo_url}
            name={program.organization?.name || 'Organization'}
          />
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-content-tertiary">
              {program.organization?.name || 'Organization'}
            </p>
            <h3 className="mt-1.5 text-base font-semibold text-content-primary transition group-hover:text-primary">
              {program.title}
            </h3>
          </div>
        </div>
        <StatusBadge status={program.status} />
      </div>

      {program.description ? (
        <p className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-content-secondary">
          {program.description}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-1.5 text-xs text-content-secondary">
        {program.category_slug || program.category?.name ? (
          <span className="rounded-full bg-surface-secondary px-2.5 py-1 capitalize">
            {(program.category?.name || program.category_slug || '').replace(/_/g, ' ')}
          </span>
        ) : null}
        <span className="rounded-full bg-surface-secondary px-2.5 py-1 capitalize">
          {program.format.replace(/_/g, ' ')}
        </span>
        {program.country ? (
          <span className="rounded-full bg-surface-secondary px-2.5 py-1">
            {program.country}
          </span>
        ) : null}
        {program.minimum_age != null || program.maximum_age != null ? (
          <span className="rounded-full bg-surface-secondary px-2.5 py-1">
            Ages {program.minimum_age ?? '—'}–{program.maximum_age ?? '—'}
          </span>
        ) : null}
        {seatsLeft != null ? (
          <span className="rounded-full bg-surface-secondary px-2.5 py-1">
            {seatsLeft} seats left
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/70 pt-3">
        {program.application_deadline ? (
          <p className="text-xs text-content-tertiary">
            Apply by {new Date(program.application_deadline).toLocaleDateString()}
          </p>
        ) : (
          <span />
        )}
        {program.my_application ? (
          <p className="text-xs font-medium capitalize text-primary">
            {program.my_application.status.replace(/_/g, ' ')}
          </p>
        ) : (
          <span className="text-xs font-medium text-primary opacity-0 transition group-hover:opacity-100">
            View details →
          </span>
        )}
      </div>
    </Link>
  )
}
