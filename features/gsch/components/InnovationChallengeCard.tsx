'use client'

import Link from 'next/link'
import { GSCH_CARD_INTERACTIVE, GSCH_CHIP } from '@/features/gsch/constants/styles'
import StatusBadge from '@/features/gsch/components/StatusBadge'
import type { GschInnovationChallenge } from '@/shared/types/gsch'

export default function InnovationChallengeCard({
  challenge,
  showPublishState = false,
}: {
  challenge: GschInnovationChallenge
  showPublishState?: boolean
}) {
  const location = [challenge.location_label, challenge.country, challenge.continent]
    .filter(Boolean)
    .join(' · ')

  return (
    <Link
      href={`/global-hub/smart-cities/${challenge.id}`}
      className={`${GSCH_CARD_INTERACTIVE} block`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-content">{challenge.title}</p>
          <p className="mt-0.5 text-xs capitalize text-content-tertiary">
            {challenge.focus_area.replace(/_/g, ' ')}
            {challenge.organization?.name ? ` · ${challenge.organization.name}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge status={challenge.status} />
          {showPublishState ? (
            <StatusBadge status={challenge.is_published ? 'published' : 'draft'} />
          ) : null}
        </div>
      </div>

      {challenge.summary ? (
        <p className="mt-2 line-clamp-2 text-sm text-content-secondary">
          {challenge.summary}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-content-tertiary">
        {location ? <span>{location}</span> : null}
        {challenge.submission_deadline ? (
          <span>
            Deadline {new Date(challenge.submission_deadline).toLocaleDateString()}
          </span>
        ) : null}
      </div>

      {challenge.tags?.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {challenge.tags.slice(0, 4).map((tag) => (
            <span key={tag} className={GSCH_CHIP}>
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  )
}
