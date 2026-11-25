'use client'

import Link from 'next/link'
import { GSCH_CARD_INTERACTIVE, GSCH_CHIP } from '@/features/gsch/constants/styles'
import StatusBadge from '@/features/gsch/components/StatusBadge'
import type { GschClimateProject } from '@/shared/types/gsch'

export default function ClimateProjectCard({
  project,
  showPublishState = false,
}: {
  project: GschClimateProject
  showPublishState?: boolean
}) {
  const location = [project.location_label, project.country, project.continent]
    .filter(Boolean)
    .join(' · ')

  return (
    <Link
      href={`/global-hub/climate/${project.id}`}
      className={`${GSCH_CARD_INTERACTIVE} block`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-content">{project.title}</p>
          <p className="mt-0.5 text-xs capitalize text-content-tertiary">
            {project.climate_type.replace(/_/g, ' ')}
            {project.organization?.name ? ` · ${project.organization.name}` : ''}
          </p>
        </div>
        {showPublishState ? (
          <StatusBadge status={project.is_published ? 'published' : 'draft'} />
        ) : null}
      </div>

      {project.summary ? (
        <p className="mt-2 line-clamp-2 text-sm text-content-secondary">{project.summary}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-content-tertiary">
        {location ? <span>{location}</span> : null}
        {project.estimated_impact ? (
          <span className="line-clamp-1">{project.estimated_impact}</span>
        ) : null}
      </div>

      {project.tags?.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {project.tags.slice(0, 4).map((tag) => (
            <span key={tag} className={GSCH_CHIP}>
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  )
}
