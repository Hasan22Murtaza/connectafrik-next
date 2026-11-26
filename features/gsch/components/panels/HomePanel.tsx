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
import GschSectionHeader from '@/features/gsch/components/GschSectionHeader'
import GschSkeleton from '@/features/gsch/components/GschSkeleton'
import GschStatCard from '@/features/gsch/components/GschStatCard'
import GschWorldMap from '@/features/gsch/components/GschWorldMap'
import InnovationChallengeCard from '@/features/gsch/components/InnovationChallengeCard'
import MatchCard from '@/features/gsch/components/MatchCard'
import OpportunityCard from '@/features/gsch/components/OpportunityCard'
import ProjectCard from '@/features/gsch/components/ProjectCard'
import StatusBadge from '@/features/gsch/components/StatusBadge'
import TourismInitiativeCard from '@/features/gsch/components/TourismInitiativeCard'
import {
  GSCH_CARD,
  GSCH_COUNT_BADGE,
  GSCH_LINK_MUTED,
} from '@/features/gsch/constants/styles'
import {
  Briefcase,
  Building2,
  Calendar,
  FileText,
  Link2,
  MapPin,
  TrendingUp,
} from '@/shared/icons'
import type { GschHomeSummary } from '@/shared/types/gsch'

function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={GSCH_LINK_MUTED}>
      {children}
    </Link>
  )
}

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
    return <GschSkeleton variant="dashboard" />
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
    return (
      <EmptyState
        title="Unable to load hub home"
        description="Something went wrong loading your Global Hub overview. Please try again."
        action={
          <button type="button" className="btn-primary text-sm" onClick={() => load()}>
            Retry
          </button>
        }
      />
    )
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
  const mapCities = (() => {
    const byId = new Map(
      [...summary.featured_cities, ...summary.my_follows, ...(summary.map_cities || [])].map(
        (c) => [c.id, c]
      )
    )
    // Prefer featured + connection endpoints so partnership arcs can render
    if (byId.size === 0) return []
    return Array.from(byId.values())
  })()
  const mapConnections = summary.map_connections || []

  const stats = analytics
    ? [
        {
          label: 'Registered cities',
          value: analytics.verified_cities ?? summary.featured_cities.length,
          icon: MapPin,
          href: '/global-hub/discover',
        },
        {
          label: 'Verified organizations',
          value: analytics.verified_organizations,
          icon: Building2,
          href: '/global-hub/organization',
        },
        {
          label: 'Active partnerships',
          value: analytics.active_partnerships,
          icon: Link2,
          href: '/global-hub/partnerships',
        },
        {
          label: 'Pending agreements',
          value: analytics.pending_agreements ?? 0,
          icon: FileText,
          href: '/global-hub/agreements',
        },
        {
          label: 'Investment opportunities',
          value: analytics.investment_projects_published ?? 0,
          icon: TrendingUp,
          href: '/global-hub/investment',
        },
        {
          label: 'Upcoming events',
          value: analytics.events,
          icon: Calendar,
          href: '/global-hub/events',
        },
      ]
    : []

  return (
    <div className="space-y-7 sm:space-y-8" data-tour="gsch-home-welcome">
      {/* Welcome + quick actions */}
      <section className={`${GSCH_CARD} border-primary/20 bg-primary/[0.04] p-6 sm:p-7`}>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
          <div className="min-w-0 max-w-2xl flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Welcome
            </p>
            <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-content sm:text-xl">
              Global collaboration at a glance
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed text-content-secondary">
              Register your organization, complete verification, publish city profiles, and
              discover international partnerships across investment, education, tourism, and
              smart-city development.
            </p>
            {cta.pending_count > 0 ? (
              <p className="mt-3 text-xs text-content-tertiary">
                {cta.pending_count} verification request
                {cta.pending_count === 1 ? '' : 's'} awaiting review.
              </p>
            ) : null}
          </div>
          <div
            className="flex w-full flex-col gap-2.5 sm:w-auto sm:min-w-[11.5rem] lg:shrink-0"
            data-tour="gsch-primary-cta"
          >
            {cta.needs_org ? (
              <Link href="/global-hub/organization" className="btn-primary w-full justify-center text-sm">
                Create organization
              </Link>
            ) : cta.needs_verification ? (
              <Link href="/global-hub/verification" className="btn-primary w-full justify-center text-sm">
                Start verification
              </Link>
            ) : (
              <Link href="/global-hub/cities" className="btn-primary w-full justify-center text-sm">
                Manage cities
              </Link>
            )}
            <Link href="/global-hub/discover" className="btn-secondary w-full justify-center text-sm">
              Discover cities
            </Link>
            <Link href="/global-hub/partnerships" className="btn-secondary w-full justify-center text-sm">
              Explore partnerships
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      {stats.length > 0 ? (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {stats.map((m) => (
            <GschStatCard
              key={m.label}
              label={m.label}
              value={m.value.toLocaleString()}
              icon={m.icon}
              href={m.href}
            />
          ))}
        </section>
      ) : null}

      {/* Pending partnerships alert */}
      {pendingPartnerships > 0 ? (
        <section className={`${GSCH_CARD} border-amber-500/25 bg-amber-500/[0.06]`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-content">
                Partnership requests awaiting you
              </h2>
              <p className="mt-1 text-sm text-content-secondary">
                You have {pendingPartnerships} pending inbound partnership request
                {pendingPartnerships === 1 ? '' : 's'}.
              </p>
            </div>
            <Link href="/global-hub/partnerships" className="btn-primary shrink-0 text-sm">
              Review requests
            </Link>
          </div>
        </section>
      ) : null}

      {/* Interactive map */}
      <div data-tour="gsch-home-map">
        <GschWorldMap cities={mapCities} connections={mapConnections} />
      </div>

      {/* Two-column: recent activity + orgs */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <GschSectionHeader
            title="Recently added cities"
            badge={
              summary.featured_cities.length ? (
                <span className={GSCH_COUNT_BADGE}>{summary.featured_cities.length}</span>
              ) : null
            }
          >
            <SectionLink href="/global-hub/discover">View all</SectionLink>
          </GschSectionHeader>
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
            <div className="grid gap-3 sm:grid-cols-2">
              {summary.featured_cities.slice(0, 4).map((city) => (
                <CityCard key={city.id} city={city} />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-6">
          <div>
            <GschSectionHeader title="Your organizations">
              <SectionLink href="/global-hub/organization">Manage</SectionLink>
            </GschSectionHeader>
            {summary.my_organizations.length === 0 ? (
              <EmptyState
                title="No organizations yet"
                description="Create an organization to publish cities and form partnerships."
                action={
                  <Link href="/global-hub/organization" className="btn-primary text-sm">
                    Create organization
                  </Link>
                }
              />
            ) : (
              <ul className="space-y-2">
                {summary.my_organizations.slice(0, 4).map((org) => (
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
          </div>

          <div>
            <GschSectionHeader title="Recently verified partners" />
            {summary.recent_verified_orgs.length === 0 ? (
              <EmptyState
                title="No verified partners yet"
                description="Verified organizations will appear here as they join the hub."
              />
            ) : (
              <ul className="space-y-2">
                {summary.recent_verified_orgs.slice(0, 4).map((org) => (
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
          </div>
        </section>
      </div>

      {/* Recommended matches */}
      {recommended.length > 0 ? (
        <section>
          <GschSectionHeader
            title="Recommended matches"
            badge={<span className={GSCH_COUNT_BADGE}>{recommended.length}</span>}
          >
            <SectionLink href="/global-hub/matching">Open matching</SectionLink>
          </GschSectionHeader>
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

      {/* Recommended opportunities */}
      {opportunities.length > 0 ? (
        <section>
          <GschSectionHeader title="Recommended opportunities">
            <SectionLink href="/global-hub/opportunities">View all</SectionLink>
          </GschSectionHeader>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {opportunities.map((opp) => (
              <OpportunityCard key={opp.id} opportunity={opp} />
            ))}
          </div>
        </section>
      ) : null}

      {featuredProjects.length > 0 ? (
        <section>
          <GschSectionHeader title="Featured investment projects">
            <SectionLink href="/global-hub/investment">View marketplace</SectionLink>
          </GschSectionHeader>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </section>
      ) : null}

      {recentBusiness.length > 0 ? (
        <section>
          <GschSectionHeader title="Recent business profiles">
            <SectionLink href="/global-hub/business">Open business centre</SectionLink>
          </GschSectionHeader>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentBusiness.map((profile) => (
              <BusinessProfileCard key={profile.id} profile={profile} />
            ))}
          </div>
        </section>
      ) : null}

      {educationHighlights.length > 0 ? (
        <section>
          <GschSectionHeader title="Education exchange">
            <SectionLink href="/global-hub/education">View all</SectionLink>
          </GschSectionHeader>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {educationHighlights.map((program) => (
              <EducationProgramCard key={program.id} program={program} />
            ))}
          </div>
        </section>
      ) : null}

      {tourismHighlights.length > 0 ? (
        <section>
          <GschSectionHeader title="Tourism collaboration">
            <SectionLink href="/global-hub/tourism">View all</SectionLink>
          </GschSectionHeader>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tourismHighlights.map((initiative) => (
              <TourismInitiativeCard key={initiative.id} initiative={initiative} />
            ))}
          </div>
        </section>
      ) : null}

      {innovationHighlights.length > 0 ? (
        <section>
          <GschSectionHeader title="Smart cities innovation">
            <SectionLink href="/global-hub/smart-cities">View all</SectionLink>
          </GschSectionHeader>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {innovationHighlights.map((challenge) => (
              <InnovationChallengeCard key={challenge.id} challenge={challenge} />
            ))}
          </div>
        </section>
      ) : null}

      {climateHighlights.length > 0 ? (
        <section>
          <GschSectionHeader title="Climate & sustainability">
            <SectionLink href="/global-hub/climate">View all</SectionLink>
          </GschSectionHeader>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {climateHighlights.map((project) => (
              <ClimateProjectCard key={project.id} project={project} />
            ))}
          </div>
        </section>
      ) : null}

      {upcomingEvents.length > 0 ? (
        <section>
          <GschSectionHeader
            title="Upcoming international events"
            badge={<span className={GSCH_COUNT_BADGE}>{upcomingEvents.length}</span>}
          >
            <SectionLink href="/global-hub/events">View all</SectionLink>
          </GschSectionHeader>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      ) : null}

      {summary.my_follows.length > 0 ? (
        <section>
          <GschSectionHeader title="Saved cities">
            <SectionLink href="/global-hub/discover">Discover more</SectionLink>
          </GschSectionHeader>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {summary.my_follows.map((city) => (
              <CityCard key={city.id} city={city} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Secondary quick links */}
      <section className={`${GSCH_CARD} flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <p className="text-sm font-medium text-content">Explore more of the hub</p>
          <p className="mt-0.5 text-xs text-content-secondary">
            Matching, opportunities, analytics, and sector marketplaces.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/global-hub/matching" className="btn-secondary text-sm">
            Partner matching
          </Link>
          <Link href="/global-hub/opportunities" className="btn-secondary text-sm">
            <Briefcase className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />
            Opportunities
          </Link>
          <Link href="/global-hub/analytics" className="btn-secondary text-sm">
            Analytics
          </Link>
        </div>
      </section>
    </div>
  )
}
