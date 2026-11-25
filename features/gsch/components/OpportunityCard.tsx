'use client'

import Link from 'next/link'
import { GSCH_CARD_INTERACTIVE, GSCH_CHIP } from '@/features/gsch/constants/styles'
import StatusBadge from '@/features/gsch/components/StatusBadge'
import type { GschOpportunity } from '@/shared/types/gsch'

export default function OpportunityCard({
  opportunity,
  showPublishState = false,
}: {
  opportunity: GschOpportunity
  showPublishState?: boolean
}) {
  const location = [
    opportunity.location_label,
    opportunity.country,
    opportunity.continent,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Link
      href={`/global-hub/opportunities/${opportunity.id}`}
      className={`${GSCH_CARD_INTERACTIVE} block`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-content">{opportunity.title}</p>
          <p className="mt-0.5 text-xs capitalize text-content-tertiary">
            {opportunity.category.replace(/_/g, ' ')}
            {opportunity.organization?.name
              ? ` · ${opportunity.organization.name}`
              : ''}
          </p>
        </div>
        {showPublishState ? (
          <StatusBadge status={opportunity.is_published ? 'published' : 'draft'} />
        ) : null}
      </div>

      {opportunity.summary ? (
        <p className="mt-2 line-clamp-2 text-sm text-content-secondary">
          {opportunity.summary}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-content-tertiary">
        {location ? <span>{location}</span> : null}
        {opportunity.application_deadline ? (
          <span>
            Deadline{' '}
            {new Date(opportunity.application_deadline).toLocaleDateString()}
          </span>
        ) : null}
      </div>

      {opportunity.tags?.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {opportunity.tags.slice(0, 4).map((tag) => (
            <span key={tag} className={GSCH_CHIP}>
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  )
}
