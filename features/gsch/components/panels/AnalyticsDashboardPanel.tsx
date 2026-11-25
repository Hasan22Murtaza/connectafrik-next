'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import EmptyState from '@/features/gsch/components/EmptyState'
import {
  GSCH_CARD,
  GSCH_SECTION_TITLE,
  GSCH_SELECT,
} from '@/features/gsch/constants/styles'
import type { GschAnalyticsSnapshot, GschOrganization } from '@/shared/types/gsch'

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className={GSCH_CARD}>
      <p className="text-xs uppercase tracking-wide text-content-tertiary">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-content">
        {value.toLocaleString()}
      </p>
    </div>
  )
}

export default function AnalyticsDashboardPanel() {
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = useState<GschAnalyticsSnapshot | null>(null)
  const [orgs, setOrgs] = useState<GschOrganization[]>([])
  const [orgId, setOrgId] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (scopedOrg?: string) => {
    setLoading(true)
    try {
      const qs = scopedOrg
        ? `?org_id=${encodeURIComponent(scopedOrg)}`
        : ''
      const snapshot = await apiClient.get<GschAnalyticsSnapshot>(
        `/api/gsch/analytics${qs}`
      )
      setData(snapshot)
    } catch (err) {
      setData(null)
      toast.error(err instanceof ApiError ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading || !user) return
    ;(async () => {
      try {
        const orgRes = await apiClient.get<GschOrganization[]>(
          '/api/gsch/organizations'
        )
        setOrgs(orgRes || [])
      } catch {
        setOrgs([])
      }
      await load()
    })()
  }, [authLoading, user?.id, load])

  if (authLoading || loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className={`${GSCH_CARD} h-24 animate-pulse`} />
        ))}
      </div>
    )
  }

  if (!user) return <EmptyState title="Sign in required" />
  if (!data) return <EmptyState title="Unable to load analytics" />

  const metrics: { label: string; value: number }[] = [
    { label: 'Organizations', value: data.total_organizations },
    { label: 'Verified orgs', value: data.verified_organizations },
    { label: 'Published cities', value: data.verified_cities },
    { label: 'Countries', value: data.countries_represented },
    { label: 'Active partnerships', value: data.active_partnerships },
    { label: 'Investment projects', value: data.investment_projects_published },
    { label: 'Business profiles', value: data.business_profiles_published },
    { label: 'Education programs', value: data.education_programs },
    { label: 'Tourism initiatives', value: data.tourism_initiatives },
    { label: 'Innovation challenges', value: data.innovation_challenges },
    { label: 'Climate projects', value: data.climate_projects },
    { label: 'Opportunities', value: data.opportunities },
    { label: 'Published events', value: data.events },
  ]

  return (
    <div className="space-y-6">
      <section className={GSCH_CARD}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className={GSCH_SECTION_TITLE}>Platform analytics</h2>
            <p className="mt-1 text-sm text-content-secondary">
              Live aggregate counts from the database — no hardcoded stats.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm">
              <span className="mb-1.5 block text-content-secondary">My org scope</span>
              <select
                className={GSCH_SELECT}
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
              >
                <option value="">Platform only</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => load(orgId || undefined)}
            >
              Refresh
            </button>
            <Link href="/global-hub" className="btn-secondary text-sm">
              Home
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <Metric key={m.label} label={m.label} value={m.value} />
        ))}
      </div>

      <section className={GSCH_CARD}>
        <h3 className={GSCH_SECTION_TITLE}>Agreements by status</h3>
        {Object.keys(data.agreements_by_status).length === 0 ? (
          <p className="mt-2 text-sm text-content-tertiary">No agreements yet.</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(data.agreements_by_status).map(([status, count]) => (
              <Metric
                key={status}
                label={status.replace(/_/g, ' ')}
                value={count}
              />
            ))}
          </div>
        )}
      </section>

      {data.my_org ? (
        <section className={GSCH_CARD}>
          <h3 className={GSCH_SECTION_TITLE}>Your organization</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Published events" value={data.my_org.published_events} />
            <Metric label="Agreements" value={data.my_org.agreements} />
            <Metric label="Active partnerships" value={data.my_org.partnerships} />
            <Metric label="Opportunities" value={data.my_org.opportunities} />
          </div>
        </section>
      ) : null}
    </div>
  )
}
