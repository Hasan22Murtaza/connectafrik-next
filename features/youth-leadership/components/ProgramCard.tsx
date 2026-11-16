'use client'

import Link from 'next/link'
import { Clock } from '@/shared/icons'
import type { YouthProgram } from '@/shared/types/youthLeadership'
import { YOUTH_CARD_INTERACTIVE, YOUTH_CHIP } from '@/features/youth-leadership/constants/nav'
import StatusBadge from './StatusBadge'
import VerifiedBadge from './VerifiedBadge'
import YouthAvatar from './YouthAvatar'

function daysUntil(deadline: string | null | undefined) {
  if (!deadline) return null
  const end = new Date(deadline)
  if (Number.isNaN(end.getTime())) return null
  const ms = end.getTime() - Date.now()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

export default function ProgramCard({ program }: { program: YouthProgram }) {
  const capacity = program.capacity
  const taken = program.seats_taken || 0
  const seatsLeft =
    capacity == null ? null : Math.max(capacity - taken, 0)
  const fillPct =
    capacity != null && capacity > 0
      ? Math.min(100, Math.round((taken / capacity) * 100))
      : null
  const days = daysUntil(program.application_deadline)
  const verified = program.organization?.verification_status === 'verified'
  const orgName = program.organization?.name || 'Organization'
  const location = [program.location_region, program.country].filter(Boolean).join(', ')

  return (
    <Link
      href={`/youth-leadership/programs/${program.id}`}
      className={`${YOUTH_CARD_INTERACTIVE} group flex h-full flex-col`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <YouthAvatar src={program.organization?.logo_url} name={orgName} />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="truncate text-sm font-medium text-content">{orgName}</p>
              {verified ? <VerifiedBadge compact label="Verified organization" /> : null}
            </div>
            {location ? (
              <p className="mt-0.5 truncate text-xs text-content-tertiary">{location}</p>
            ) : null}
          </div>
        </div>
        <StatusBadge status={program.status} />
      </div>

      <h3 className="mt-4 text-[0.98rem] font-semibold leading-snug tracking-tight text-content transition group-hover:text-primary">
        {program.title}
      </h3>

      {program.description ? (
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-content-secondary">
          {program.description}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-1.5">
        {program.category_slug || program.category?.name ? (
          <span className={`${YOUTH_CHIP} capitalize`}>
            {(program.category?.name || program.category_slug || '').replace(/_/g, ' ')}
          </span>
        ) : null}
        <span className={`${YOUTH_CHIP} capitalize`}>
          {program.format.replace(/_/g, ' ')}
        </span>
        {program.minimum_age != null || program.maximum_age != null ? (
          <span className={YOUTH_CHIP}>
            {program.minimum_age ?? '—'}–{program.maximum_age ?? '—'} yrs
          </span>
        ) : null}
        {program.requires_guardian_approval ? (
          <span className={YOUTH_CHIP}>Guardian approval</span>
        ) : null}
        {(program.required_skills || []).slice(0, 2).map((skill) => (
          <span key={skill} className={YOUTH_CHIP}>
            {skill}
          </span>
        ))}
      </div>

      {fillPct != null ? (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-content-secondary">
            <span>Cohort seats</span>
            <span className="tabular-nums">
              {taken}
              {capacity != null ? ` / ${capacity}` : ''} ({fillPct}%)
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-secondary">
            <div
              className={`h-full rounded-full ${
                fillPct >= 90 ? 'bg-emerald-500' : 'bg-primary'
              }`}
              style={{ width: `${fillPct}%` }}
            />
          </div>
          {seatsLeft != null ? (
            <p className="mt-1.5 text-xs text-content-tertiary">
              {seatsLeft === 0 ? 'Cohort full' : `${seatsLeft} seats left`}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3 mt-4">
        <div className="min-w-0 text-xs text-content-tertiary">
          {days != null ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {days < 0
                ? 'Deadline passed'
                : days === 0
                  ? 'Closes today'
                  : `Closing in ${days} day${days === 1 ? '' : 's'}`}
            </span>
          ) : program.application_deadline ? (
            <span>
              Apply by {new Date(program.application_deadline).toLocaleDateString()}
            </span>
          ) : (
            <span>Open enrollment</span>
          )}
        </div>

        {program.my_application ? (
          <span className="shrink-0 text-xs font-medium capitalize text-primary">
            {program.my_application.status.replace(/_/g, ' ')}
          </span>
        ) : (
          <span className="shrink-0 text-xs font-semibold text-primary">
            View &amp; apply →
          </span>
        )}
      </div>
    </Link>
  )
}
