'use client'

import Link from 'next/link'
import { GSCH_CARD_INTERACTIVE, GSCH_CHIP } from '@/features/gsch/constants/styles'
import StatusBadge from '@/features/gsch/components/StatusBadge'
import type { GschEvent } from '@/shared/types/gsch'

export default function EventCard({
  event,
  showPublishState = false,
}: {
  event: GschEvent
  showPublishState?: boolean
}) {
  const location = [event.location_label, event.country, event.continent]
    .filter(Boolean)
    .join(' · ')

  return (
    <Link href={`/global-hub/events/${event.id}`} className={`${GSCH_CARD_INTERACTIVE} block`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-content">{event.title}</p>
          <p className="mt-0.5 text-xs capitalize text-content-tertiary">
            {event.event_type.replace(/_/g, ' ')}
            {event.organization?.name ? ` · ${event.organization.name}` : ''}
          </p>
        </div>
        {showPublishState ? (
          <StatusBadge status={event.is_published ? 'published' : 'draft'} />
        ) : event.is_registered ? (
          <StatusBadge status="registered" />
        ) : null}
      </div>

      {event.summary ? (
        <p className="mt-2 line-clamp-2 text-sm text-content-secondary">{event.summary}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-content-tertiary">
        {location ? <span>{location}</span> : null}
        {event.starts_at ? (
          <span>Starts {new Date(event.starts_at).toLocaleString()}</span>
        ) : null}
      </div>

      {event.tags?.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {event.tags.slice(0, 4).map((tag) => (
            <span key={tag} className={GSCH_CHIP}>
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  )
}
