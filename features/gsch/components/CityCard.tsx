'use client'

import Link from 'next/link'
import { MapPin, Users } from '@/shared/icons'
import type { GschCity } from '@/shared/types/gsch'
import { GSCH_CARD_INTERACTIVE, GSCH_CHIP } from '@/features/gsch/constants/styles'

function formatPopulation(n: number | null | undefined) {
  if (n == null) return null
  return new Intl.NumberFormat('en', { notation: 'compact' }).format(n)
}

export default function CityCard({
  city,
  onToggleFollow,
  followBusy,
}: {
  city: GschCity
  onToggleFollow?: (city: GschCity) => void
  followBusy?: boolean
}) {
  const location = [city.state_province, city.country].filter(Boolean).join(', ')
  const pop = formatPopulation(city.population)

  return (
    <article className={`${GSCH_CARD_INTERACTIVE} flex h-full flex-col`}>
      <Link href={`/global-hub/cities/${city.id}`} className="min-w-0 flex-1">
        {city.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={city.cover_image_url}
            alt=""
            className="mb-3 h-28 w-full rounded-xl object-cover"
          />
        ) : (
          <div className="mb-3 flex h-28 items-center justify-center rounded-xl bg-primary/10">
            <MapPin className="h-7 w-7 text-primary" aria-hidden />
          </div>
        )}
        <h3 className="text-[0.98rem] font-semibold leading-snug tracking-tight text-content transition hover:text-primary">
          {city.name}
        </h3>
        {location ? (
          <p className="mt-1.5 flex items-center gap-1 truncate text-xs text-content-tertiary">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden />
            {location}
          </p>
        ) : null}
        {city.description ? (
          <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-content-secondary">
            {city.description}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {city.continent ? <span className={GSCH_CHIP}>{city.continent}</span> : null}
          {pop ? (
            <span className={`${GSCH_CHIP} inline-flex items-center gap-1`}>
              <Users className="h-3 w-3" aria-hidden />
              {pop}
            </span>
          ) : null}
          {(city.major_industries || []).slice(0, 2).map((ind) => (
            <span key={ind} className={GSCH_CHIP}>
              {ind}
            </span>
          ))}
        </div>
      </Link>

      {onToggleFollow ? (
        <div className="mt-4 border-t border-border pt-3">
          <button
            type="button"
            className={
              city.is_followed
                ? 'btn-secondary h-9 w-full text-sm'
                : 'btn-primary h-9 w-full text-sm'
            }
            disabled={followBusy}
            onClick={() => onToggleFollow(city)}
          >
            {city.is_followed ? 'Saved' : 'Save city'}
          </button>
        </div>
      ) : null}
    </article>
  )
}
