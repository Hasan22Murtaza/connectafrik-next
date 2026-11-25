'use client'

import Link from 'next/link'
import { GSCH_CARD_INTERACTIVE, GSCH_CHIP } from '@/features/gsch/constants/styles'
import StatusBadge from '@/features/gsch/components/StatusBadge'
import type { GschEducationProgram } from '@/shared/types/gsch'

export default function EducationProgramCard({
  program,
  showPublishState = false,
}: {
  program: GschEducationProgram
  showPublishState?: boolean
}) {
  const location = [program.location_label, program.country, program.continent]
    .filter(Boolean)
    .join(' · ')

  return (
    <Link
      href={`/global-hub/education/${program.id}`}
      className={`${GSCH_CARD_INTERACTIVE} block`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-content">{program.title}</p>
          <p className="mt-0.5 text-xs capitalize text-content-tertiary">
            {program.program_type.replace(/_/g, ' ')}
            {program.organization?.name ? ` · ${program.organization.name}` : ''}
          </p>
        </div>
        {showPublishState ? (
          <StatusBadge status={program.is_published ? 'published' : 'draft'} />
        ) : null}
      </div>

      {program.summary ? (
        <p className="mt-2 line-clamp-2 text-sm text-content-secondary">{program.summary}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-content-tertiary">
        {program.institution_name ? <span>{program.institution_name}</span> : null}
        {location ? <span>{location}</span> : null}
        {program.application_deadline ? (
          <span>
            Deadline {new Date(program.application_deadline).toLocaleDateString()}
          </span>
        ) : null}
      </div>

      {program.tags?.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {program.tags.slice(0, 4).map((tag) => (
            <span key={tag} className={GSCH_CHIP}>
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  )
}
