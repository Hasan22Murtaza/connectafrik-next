'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { MapPin, Users } from '@/shared/icons'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import EmptyState from '@/features/gsch/components/EmptyState'
import GschDetailHeader from '@/features/gsch/components/GschDetailHeader'
import StatusBadge from '@/features/gsch/components/StatusBadge'
import { GSCH_CARD, GSCH_CHIP, GSCH_SECTION_TITLE } from '@/features/gsch/constants/styles'
import type { GschCity } from '@/shared/types/gsch'

type CityDetail = GschCity & { can_manage?: boolean }

export default function CityDetailPanel({ cityId }: { cityId: string }) {
  const { user, loading: authLoading } = useAuth()
  const [city, setCity] = useState<CityDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiClient.get<CityDetail>(`/api/gsch/cities/${cityId}`)
      setCity(data)
    } catch (err) {
      setCity(null)
      toast.error(err instanceof ApiError ? err.message : 'Failed to load city')
    } finally {
      setLoading(false)
    }
  }, [cityId])

  useEffect(() => {
    if (authLoading || !user) return
    load()
  }, [authLoading, user?.id, load])

  if (authLoading || loading) {
    return <div className={`${GSCH_CARD} h-64 animate-pulse`} />
  }

  if (!user) return <EmptyState title="Sign in required" />
  if (!city) return <EmptyState title="City not found" />

  const location = [city.state_province, city.country, city.continent]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="space-y-6">
      {city.cover_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={city.cover_image_url}
          alt=""
          className="h-48 w-full rounded-2xl object-cover sm:h-64"
        />
      ) : (
        <div className="flex h-40 items-center justify-center rounded-2xl bg-primary/10">
          <MapPin className="h-10 w-10 text-primary" aria-hidden />
        </div>
      )}

      <GschDetailHeader
        backHref="/global-hub/cities"
        backLabel="Back to cities"
        title={city.name}
        badges={<StatusBadge status={city.is_published ? 'published' : 'draft'} />}
        subtitle={
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden />
            {location}
          </span>
        }
        meta={
          city.population != null ? (
            <span className="inline-flex items-center gap-1">
              <Users className="h-4 w-4" aria-hidden />
              {city.population.toLocaleString()} residents
            </span>
          ) : undefined
        }
      />

      {city.description ? (
        <section className={GSCH_CARD}>
          <h3 className={GSCH_SECTION_TITLE}>About</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-content-secondary">
            {city.description}
          </p>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={GSCH_CARD}>
          <h3 className={GSCH_SECTION_TITLE}>Key facts</h3>
          <dl className="mt-3 space-y-2 text-sm">
            {city.mayor_name ? (
              <div>
                <dt className="text-content-tertiary">Mayor / leader</dt>
                <dd className="text-content">{city.mayor_name}</dd>
              </div>
            ) : null}
            {city.official_website ? (
              <div>
                <dt className="text-content-tertiary">Website</dt>
                <dd>
                  <a
                    href={city.official_website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {city.official_website}
                  </a>
                </dd>
              </div>
            ) : null}
            {city.organization ? (
              <div>
                <dt className="text-content-tertiary">Organization</dt>
                <dd className="text-content">{city.organization.name}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className={GSCH_CARD}>
          <h3 className={GSCH_SECTION_TITLE}>Industries & interests</h3>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(city.major_industries || []).map((i) => (
              <span key={i} className={GSCH_CHIP}>
                {i}
              </span>
            ))}
            {(city.collaboration_interests || []).map((i) => (
              <span key={i} className={GSCH_CHIP}>
                {i}
              </span>
            ))}
            {(city.interests || []).map((i) => (
              <span key={i.id} className={GSCH_CHIP}>
                {i.interest_label}
              </span>
            ))}
            {!city.major_industries?.length &&
            !city.collaboration_interests?.length &&
            !city.interests?.length ? (
              <p className="text-sm text-content-tertiary">No interests listed yet.</p>
            ) : null}
          </div>
        </section>
      </div>

      {(city.economic_info ||
        city.investment_opportunities ||
        city.climate_objectives ||
        city.renewable_energy_initiatives) && (
        <section className={GSCH_CARD}>
          <h3 className={GSCH_SECTION_TITLE}>Development & climate</h3>
          <div className="mt-3 space-y-3 text-sm text-content-secondary">
            {city.economic_info ? <p>{city.economic_info}</p> : null}
            {city.investment_opportunities ? (
              <p>
                <span className="font-medium text-content">Investment: </span>
                {city.investment_opportunities}
              </p>
            ) : null}
            {city.climate_objectives ? (
              <p>
                <span className="font-medium text-content">Climate: </span>
                {city.climate_objectives}
              </p>
            ) : null}
            {city.renewable_energy_initiatives ? (
              <p>
                <span className="font-medium text-content">Renewables: </span>
                {city.renewable_energy_initiatives}
              </p>
            ) : null}
          </div>
        </section>
      )}

      {(city.existing_sister_cities || []).length > 0 ? (
        <section className={GSCH_CARD}>
          <h3 className={GSCH_SECTION_TITLE}>Existing sister cities</h3>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {city.existing_sister_cities.map((s) => (
              <span key={s} className={GSCH_CHIP}>
                {s}
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
