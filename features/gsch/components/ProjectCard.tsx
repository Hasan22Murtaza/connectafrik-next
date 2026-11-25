'use client'

import Link from 'next/link'
import { GSCH_CARD_INTERACTIVE, GSCH_CHIP } from '@/features/gsch/constants/styles'
import StatusBadge from '@/features/gsch/components/StatusBadge'
import type { GschProject } from '@/shared/types/gsch'

function formatMoney(amount: number | null, currency: string | null) {
  if (amount == null) return null
  const cur = currency || 'USD'
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: cur,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${cur} ${amount}`
  }
}

export default function ProjectCard({
  project,
  showPublishState = false,
}: {
  project: GschProject
  showPublishState?: boolean
}) {
  const location = [project.location_label, project.country, project.continent]
    .filter(Boolean)
    .join(' · ')
  const funding = formatMoney(
    project.funding_required_amount,
    project.funding_required_currency
  )

  return (
    <Link
      href={`/global-hub/investment/${project.id}`}
      className={`${GSCH_CARD_INTERACTIVE} block`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-content">{project.title}</p>
          <p className="mt-0.5 text-xs capitalize text-content-tertiary">
            {project.category.replace(/_/g, ' ')}
            {project.organization?.name ? ` · ${project.organization.name}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge status={project.project_stage} />
          {showPublishState ? (
            <StatusBadge status={project.is_published ? 'published' : 'draft'} />
          ) : null}
        </div>
      </div>

      {project.description ? (
        <p className="mt-2 line-clamp-2 text-sm text-content-secondary">
          {project.description}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-content-tertiary">
        {location ? <span>{location}</span> : null}
        {funding ? <span>Funding sought {funding}</span> : null}
        {project.verification_status === 'verified' ? (
          <StatusBadge status="verified" />
        ) : null}
        {project.is_saved ? <span className={GSCH_CHIP}>Saved</span> : null}
      </div>
    </Link>
  )
}
