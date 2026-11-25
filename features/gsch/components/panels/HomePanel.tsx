'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import BusinessProfileCard from '@/features/gsch/components/BusinessProfileCard'
import CityCard from '@/features/gsch/components/CityCard'
import ClimateProjectCard from '@/features/gsch/components/ClimateProjectCard'
import EducationProgramCard from '@/features/gsch/components/EducationProgramCard'
import EmptyState from '@/features/gsch/components/EmptyState'
import EventCard from '@/features/gsch/components/EventCard'
import InnovationChallengeCard from '@/features/gsch/components/InnovationChallengeCard'
import MatchCard from '@/features/gsch/components/MatchCard'
import OpportunityCard from '@/features/gsch/components/OpportunityCard'
import ProjectCard from '@/features/gsch/components/ProjectCard'
import StatusBadge from '@/features/gsch/components/StatusBadge'
import TourismInitiativeCard from '@/features/gsch/components/TourismInitiativeCard'
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
  const recommended = summary.recommended_matches || []
  const opportunities = summary.trending_opportunities || []
  const featuredProjects = summary.featured_projects || []
  const recentBusiness = summary.recent_business_profiles || []
  const educationHighlights = summary.education_highlights || []
  const tourismHighlights = summary.tourism_highlights || []
  const innovationHighlights = summary.innovation_highlights || []
  const climateHighlights = summary.climate_highlights || []
  const upcomingEvents = summary.upcoming_events || []
  const analytics = summary.analytics_snapshot
  const pendingPartnerships = summary.pending_partnership_requests || 0

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
          <Link href="/global-hub/matching" className="btn-secondary text-sm">
            Partner matching
          </Link>
          <Link href="/global-hub/analytics" className="btn-secondary text-sm">
            Analytics
          </Link>
        </div>
        {cta.pending_count > 0 ? (
          <p className="mt-3 text-xs text-content-tertiary">
            {cta.pending_count} verification request(s) awaiting review.
          </p>
        ) : null}
      </section>

      {analytics ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Organizations', value: analytics.total_organizations },
            { label: 'Verified orgs', value: analytics.verified_organizations },
            { label: 'Active partnerships', value: analytics.active_partnerships },
            { label: 'Published events', value: analytics.events },
          ].map((m) => (
            <div key={m.label} className={GSCH_CARD}>
              <p className="text-xs uppercase tracking-wide text-content-tertiary">
                {m.label}
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-content">
                {m.value.toLocaleString()}
              </p>
            </div>
          ))}
        </section>
      ) : null}

      {pendingPartnerships > 0 ? (
        <section className={`${GSCH_CARD} border-amber-500/20 bg-amber-500/5`}>
          <h2 className={GSCH_SECTION_TITLE}>Partnership requests awaiting you</h2>
          <p className="mt-2 text-sm text-content-secondary">
            You have {pendingPartnerships} pending inbound partnership request
            {pendingPartnerships === 1 ? '' : 's'}.
          </p>
          <Link href="/global-hub/partnerships" className="btn-primary mt-4 inline-flex text-sm">
            Review requests
          </Link>
        </section>
      ) : null}

      {recommended.length > 0 ? (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className={GSCH_SECTION_TITLE}>Recommended matches</h2>
            <Link href="/global-hub/matching" className="text-sm font-medium text-primary">
              Open matching
            </Link>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {recommended.slice(0, 4).map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                connectHref={`/global-hub/partnerships?target_city=${match.recommended_city_id}`}
              />
            ))}
          </div>
        </section>
      ) : null}

      {opportunities.length > 0 ? (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className={GSCH_SECTION_TITLE}>Trending opportunities</h2>
            <Link
              href="/global-hub/opportunities"
              className="text-sm font-medium text-primary"
            >
              View all
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {opportunities.map((opp) => (
              <OpportunityCard key={opp.id} opportunity={opp} />
            ))}
          </div>
        </section>
      ) : null}

      {featuredProjects.length > 0 ? (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className={GSCH_SECTION_TITLE}>Featured investment projects</h2>
            <Link
              href="/global-hub/investment"
              className="text-sm font-medium text-primary"
            >
              View marketplace
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </section>
      ) : null}

      {recentBusiness.length > 0 ? (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className={GSCH_SECTION_TITLE}>Recent business profiles</h2>
            <Link
              href="/global-hub/business"
              className="text-sm font-medium text-primary"
            >
              Open business centre
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentBusiness.map((profile) => (
              <BusinessProfileCard key={profile.id} profile={profile} />
            ))}
          </div>
        </section>
      ) : null}

      {educationHighlights.length > 0 ? (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className={GSCH_SECTION_TITLE}>Education exchange</h2>
            <Link href="/global-hub/education" className="text-sm font-medium text-primary">
              View all
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {educationHighlights.map((program) => (
              <EducationProgramCard key={program.id} program={program} />
            ))}
          </div>
        </section>
      ) : null}

      {tourismHighlights.length > 0 ? (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className={GSCH_SECTION_TITLE}>Eco-tourism collaboration</h2>
            <Link href="/global-hub/tourism" className="text-sm font-medium text-primary">
              View all
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tourismHighlights.map((initiative) => (
              <TourismInitiativeCard key={initiative.id} initiative={initiative} />
            ))}
          </div>
        </section>
      ) : null}

      {innovationHighlights.length > 0 ? (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className={GSCH_SECTION_TITLE}>Smart cities innovation</h2>
            <Link
              href="/global-hub/smart-cities"
              className="text-sm font-medium text-primary"
            >
              View all
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {innovationHighlights.map((challenge) => (
              <InnovationChallengeCard key={challenge.id} challenge={challenge} />
            ))}
          </div>
        </section>
      ) : null}

      {climateHighlights.length > 0 ? (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className={GSCH_SECTION_TITLE}>Climate & sustainability</h2>
            <Link href="/global-hub/climate" className="text-sm font-medium text-primary">
              View all
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {climateHighlights.map((project) => (
              <ClimateProjectCard key={project.id} project={project} />
            ))}
          </div>
        </section>
      ) : null}

      {upcomingEvents.length > 0 ? (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className={GSCH_SECTION_TITLE}>Upcoming events</h2>
            <Link href="/global-hub/events" className="text-sm font-medium text-primary">
              View all
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      ) : null}

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
