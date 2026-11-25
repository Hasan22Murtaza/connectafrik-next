'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MapPin } from '@/shared/icons'
import { GSCH_CARD, GSCH_CHIP } from '@/features/gsch/constants/styles'
import type { GschMatchRecommendation } from '@/shared/types/gsch'

export default function MatchCard({
  match,
  connectHref,
}: {
  match: GschMatchRecommendation
  connectHref?: string
}) {
  const [showBreakdown, setShowBreakdown] = useState(false)
  const city = match.recommended_city
  const score = Number(match.compatibility_score)

  return (
    <article className={GSCH_CARD}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={city ? `/global-hub/cities/${city.id}` : '#'}
            className="truncate font-semibold text-content hover:text-primary"
          >
            {city?.name || 'Recommended city'}
          </Link>
          {city ? (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-content-tertiary">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              {[city.country, city.continent].filter(Boolean).join(' · ')}
            </p>
          ) : null}
        </div>
        <div className="shrink-0 rounded-xl bg-primary/10 px-3 py-1.5 text-center">
          <p className="text-lg font-semibold tabular-nums text-primary">
            {score.toFixed(1)}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-content-tertiary">
            match
          </p>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-content-secondary">
        {match.explanation}
      </p>

      {match.shared_interests?.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {match.shared_interests.slice(0, 6).map((interest) => (
            <span key={interest} className={GSCH_CHIP}>
              {interest}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-secondary text-xs"
          onClick={() => setShowBreakdown((v) => !v)}
        >
          {showBreakdown ? 'Hide breakdown' : 'Score breakdown'}
        </button>
        {connectHref ? (
          <Link href={connectHref} className="btn-primary text-xs">
            Connect
          </Link>
        ) : null}
        {city ? (
          <Link
            href={`/global-hub/cities/${city.id}`}
            className="text-xs font-medium text-primary"
          >
            View city
          </Link>
        ) : null}
      </div>

      {showBreakdown && match.score_breakdown ? (
        <ul className="mt-3 space-y-1.5 rounded-xl bg-surface-secondary/60 p-3 text-xs">
          {Object.entries(match.score_breakdown).map(([key, value]) => (
            <li key={key} className="flex items-center justify-between gap-2">
              <span className="capitalize text-content-secondary">
                {key.replace(/_/g, ' ')}
                <span className="text-content-tertiary">
                  {' '}
                  · weight {value.weight}
                </span>
              </span>
              <span className="tabular-nums text-content">
                {value.overlap} overlap · {Number(value.score).toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  )
}
