'use client'

import Link from 'next/link'
import { GSCH_CARD_INTERACTIVE, GSCH_CHIP } from '@/features/gsch/constants/styles'
import StatusBadge from '@/features/gsch/components/StatusBadge'
import type { GschBusinessProfile } from '@/shared/types/gsch'

export default function BusinessProfileCard({
  profile,
  showPublishState = false,
}: {
  profile: GschBusinessProfile
  showPublishState?: boolean
}) {
  const location = [profile.city, profile.country].filter(Boolean).join(', ')

  return (
    <Link
      href={`/global-hub/business/${profile.id}`}
      className={`${GSCH_CARD_INTERACTIVE} block`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-content">{profile.display_name}</p>
          {profile.tagline ? (
            <p className="mt-0.5 truncate text-xs text-content-tertiary">
              {profile.tagline}
            </p>
          ) : null}
        </div>
        {showPublishState ? (
          <StatusBadge status={profile.is_published ? 'published' : 'draft'} />
        ) : null}
      </div>

      {profile.description ? (
        <p className="mt-2 line-clamp-2 text-sm text-content-secondary">
          {profile.description}
        </p>
      ) : null}

      {location ? (
        <p className="mt-2 text-xs text-content-tertiary">{location}</p>
      ) : null}

      {(profile.seeking?.length > 0 || profile.offering?.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {profile.seeking?.slice(0, 3).map((s) => (
            <span key={`s-${s}`} className={GSCH_CHIP}>
              Seeking {s}
            </span>
          ))}
          {profile.offering?.slice(0, 3).map((o) => (
            <span key={`o-${o}`} className={GSCH_CHIP}>
              Offers {o}
            </span>
          ))}
        </div>
      )}
    </Link>
  )
}
