'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import CityCard from '@/features/gsch/components/CityCard'
import EmptyState from '@/features/gsch/components/EmptyState'
import StatusBadge from '@/features/gsch/components/StatusBadge'
import { GSCH_CARD, GSCH_SECTION_TITLE } from '@/features/gsch/constants/styles'
import type { GschHomeSummary } from '@/shared/types/gsch'

export default function HomePanel() {
  const { user, loading: authLoading } = useAuth()
  const [summary, setSummary] = useState<GschHomeSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiClient.get<GschHomeSummary>('/api/gsch/home')
      setSummary(data)
    } catch (err) {
      setSummary(null)
      toast.error(err instanceof ApiError ? err.message : 'Failed to load hub home')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading || !user) return
    load()
  }, [authLoading, user?.id, load])

  if (authLoading || loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`${GSCH_CARD} h-48 animate-pulse bg-surface-secondary/60`} />
        ))}
      </div>
    )
  }

  if (!user) {
    return (
      <EmptyState
        title="Sign in required"
        description="The Global Sister Cities Partnership Hub requires an authenticated ConnectAfrik account."
      />
    )
  }

  if (!summary) {
    return <EmptyState title="Unable to load hub home" />
  }

  const cta = summary.verification_cta

  return (
    <div className="space-y-8">
      <section className={`${GSCH_CARD} border-primary/20 bg-primary/5`}>
        <h2 className={GSCH_SECTION_TITLE}>Welcome to the Global Hub</h2>
        <p className="mt-2 text-sm text-content-secondary">
          Register your organization, complete human-reviewed verification, and publish city
          profiles for sister-city collaboration.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {cta.needs_org ? (
            <Link href="/global-hub/organization" className="btn-primary text-sm">
              Create organization
            </Link>
          ) : cta.needs_verification ? (
            <Link href="/global-hub/verification" className="btn-primary text-sm">
              Start verification
            </Link>
          ) : (
            <Link href="/global-hub/cities" className="btn-primary text-sm">
              Manage city profiles
            </Link>
          )}
          <Link href="/global-hub/discover" className="btn-secondary text-sm">
            Discover cities
          </Link>
        </div>
        {cta.pending_count > 0 ? (
          <p className="mt-3 text-xs text-content-tertiary">
            {cta.pending_count} verification request(s) awaiting review.
          </p>
        ) : null}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className={GSCH_SECTION_TITLE}>Featured cities</h2>
          <Link href="/global-hub/discover" className="text-sm font-medium text-primary">
            View all
          </Link>
        </div>
        {summary.featured_cities.length === 0 ? (
          <EmptyState
            title="No published cities yet"
            description="Be the first to publish a city profile for your organization."
            action={
              <Link href="/global-hub/cities" className="btn-primary text-sm">
                Create city profile
              </Link>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {summary.featured_cities.map((city) => (
              <CityCard key={city.id} city={city} />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className={`${GSCH_SECTION_TITLE} mb-3`}>Your organizations</h2>
          {summary.my_organizations.length === 0 ? (
            <EmptyState
              title="No organizations yet"
              action={
                <Link href="/global-hub/organization" className="btn-primary text-sm">
                  Create organization
                </Link>
              }
            />
          ) : (
            <ul className="space-y-2">
              {summary.my_organizations.map((org) => (
                <li key={org.id} className={GSCH_CARD}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-content">{org.name}</p>
                      <p className="mt-0.5 text-xs text-content-tertiary">
                        {[org.city, org.country].filter(Boolean).join(', ')}
                      </p>
                    </div>
                    <StatusBadge status={org.verification_status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className={`${GSCH_SECTION_TITLE} mb-3`}>Recently verified partners</h2>
          {summary.recent_verified_orgs.length === 0 ? (
            <EmptyState title="No verified partners yet" />
          ) : (
            <ul className="space-y-2">
              {summary.recent_verified_orgs.map((org) => (
                <li key={org.id} className={GSCH_CARD}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-content">{org.name}</p>
                      <p className="mt-0.5 text-xs capitalize text-content-tertiary">
                        {org.org_type.replace(/_/g, ' ')} · {org.country}
                      </p>
                    </div>
                    <StatusBadge status="verified" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {summary.my_follows.length > 0 ? (
        <section>
          <h2 className={`${GSCH_SECTION_TITLE} mb-3`}>Saved cities</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {summary.my_follows.map((city) => (
              <CityCard key={city.id} city={city} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
