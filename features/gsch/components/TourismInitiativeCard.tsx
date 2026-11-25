'use client'

import Link from 'next/link'
import { GSCH_CARD_INTERACTIVE, GSCH_CHIP } from '@/features/gsch/constants/styles'
import StatusBadge from '@/features/gsch/components/StatusBadge'
import type { GschTourismInitiative } from '@/shared/types/gsch'

export default function TourismInitiativeCard({
  initiative,
  showPublishState = false,
}: {
  initiative: GschTourismInitiative
  showPublishState?: boolean
}) {
  const location = [initiative.location_label, initiative.country, initiative.continent]
    .filter(Boolean)
    .join(' · ')

  return (
    <Link
      href={`/global-hub/tourism/${initiative.id}`}
      className={`${GSCH_CARD_INTERACTIVE} block`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-content">{initiative.title}</p>
          <p className="mt-0.5 text-xs capitalize text-content-tertiary">
            {initiative.tourism_type.replace(/_/g, ' ')}
            {initiative.organization?.name ? ` · ${initiative.organization.name}` : ''}
          </p>
        </div>
        {showPublishState ? (
          <StatusBadge status={initiative.is_published ? 'published' : 'draft'} />
        ) : null}
      </div>

      {initiative.summary ? (
        <p className="mt-2 line-clamp-2 text-sm text-content-secondary">
          {initiative.summary}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-content-tertiary">
        {location ? <span>{location}</span> : null}
        {initiative.season_label ? <span>{initiative.season_label}</span> : null}
      </div>

      {initiative.tags?.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {initiative.tags.slice(0, 4).map((tag) => (
            <span key={tag} className={GSCH_CHIP}>
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  )
}
