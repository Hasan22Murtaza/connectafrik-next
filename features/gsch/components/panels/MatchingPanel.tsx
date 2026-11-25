'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import EmptyState from '@/features/gsch/components/EmptyState'
import GschFilterDrawer from '@/features/gsch/components/GschFilterDrawer'
import GschFiltersButton, {
  countActiveFilters,
} from '@/features/gsch/components/GschFiltersButton'
import {
  GschDataTable,
  GschRowActions,
  GschTableBody,
  GschTableCell,
  GschTableHead,
  GschTableHeadCell,
  GschTableRow,
} from '@/features/gsch/components/GschDataTable'
import {
  GSCH_CARD,
  GSCH_LABEL,
  GSCH_MUTED,
  GSCH_SECTION_TITLE,
  GSCH_SELECT,
} from '@/features/gsch/constants/styles'
import { GSCH_MATCH_WEIGHTS_UI } from '@/shared/types/gsch'
import type { GschCity, GschMatchRecommendation, GschPaginated } from '@/shared/types/gsch'

type MatchResponse = GschPaginated<GschMatchRecommendation> & {
  city_id: string | null
  can_recompute?: boolean
}

export default function MatchingPanel({
  initialCityId,
}: {
  initialCityId?: string
}) {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [cities, setCities] = useState<GschCity[]>([])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState({ city_id: initialCityId || '' })
  const [applied, setApplied] = useState(filters)
  const [matches, setMatches] = useState<GschMatchRecommendation[]>([])
  const [canRecompute, setCanRecompute] = useState(false)
  const [loading, setLoading] = useState(true)
  const [recomputing, setRecomputing] = useState(false)

  const activeFilterCount = countActiveFilters(applied)
  const cityId = applied.city_id

  const loadCities = useCallback(async () => {
    try {
      const [mine, saved] = await Promise.all([
        apiClient.get<GschPaginated<GschCity>>('/api/gsch/cities?mine=1&limit=50'),
        apiClient.get<GschPaginated<GschCity>>('/api/gsch/cities?saved=1&limit=50'),
      ])
      const byId = new Map<string, GschCity>()
      for (const c of [...(mine.data || []), ...(saved.data || [])]) {
        if (c.is_published) byId.set(c.id, c)
      }
      const list = Array.from(byId.values())
      setCities(list)
      setApplied((current) => {
        if (current.city_id) return current
        const next = list[0]?.id || ''
        if (!next) return current
        setFilters((f) => ({ ...f, city_id: f.city_id || next }))
        return { city_id: next }
      })
    } catch {
      setCities([])
    }
  }, [])

  const loadMatches = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const qs = id ? `?city_id=${encodeURIComponent(id)}&limit=20` : '?limit=20'
      const data = await apiClient.get<MatchResponse>(`/api/gsch/matching${qs}`)
      setMatches(data.data || [])
      if (data.city_id) {
        setApplied((current) => {
          if (current.city_id) return current
          setFilters((f) => ({ ...f, city_id: f.city_id || data.city_id || '' }))
          return { city_id: data.city_id || '' }
        })
      }
      setCanRecompute(Boolean(data.can_recompute))
    } catch (err) {
      setMatches([])
      toast.error(err instanceof ApiError ? err.message : 'Failed to load matches')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading || !user) return
    loadCities()
  }, [authLoading, user?.id, loadCities])

  useEffect(() => {
    if (authLoading || !user) return
    loadMatches(cityId)
  }, [authLoading, user?.id, cityId, loadMatches])

  async function recompute() {
    if (!cityId) return
    setRecomputing(true)
    try {
      const data = await apiClient.post<MatchResponse>('/api/gsch/matching/recompute', {
        city_id: cityId,
        limit: 20,
      })
      setMatches(data.data || [])
      toast.success(
        data.data?.length
          ? `Found ${data.data.length} real data overlap(s)`
          : 'No positive-score overlaps with published cities yet'
      )
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Recompute failed')
    } finally {
      setRecomputing(false)
    }
  }

  function applyFilters() {
    setApplied(filters)
    setFiltersOpen(false)
  }

  function resetFilters() {
    const empty = { city_id: '' }
    setFilters(empty)
    setApplied(empty)
    setFiltersOpen(false)
  }

  if (authLoading || (loading && matches.length === 0 && !cityId)) {
    return (
      <div className={`${GSCH_CARD} h-40 animate-pulse`} />
    )
  }

  if (!user) {
    return <EmptyState title="Sign in required" />
  }

  return (
    <div className="space-y-6">
      <section className={GSCH_CARD}>
        <h2 className={GSCH_SECTION_TITLE}>Transparent partner matching</h2>
        <p className={`${GSCH_MUTED} mt-2`}>
          Scores use only real profile overlap (weighted_v1). Empty fields contribute
          zero — nothing is invented. Advanced AI matching is future work; opportunity
          affinity is a light secondary insight when city interests share tags with
          published opportunities.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-content-tertiary">
          {Object.entries(GSCH_MATCH_WEIGHTS_UI).map(([key, weight]) => (
            <span
              key={key}
              className="rounded-full bg-surface-secondary px-2 py-0.5 capitalize"
            >
              {key.replace(/_/g, ' ')} {weight}
            </span>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {canRecompute ? (
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={!cityId || recomputing}
            onClick={recompute}
          >
            {recomputing ? 'Computing…' : 'Recompute matches'}
          </button>
        ) : (
          <span />
        )}
        <GschFiltersButton
          activeCount={activeFilterCount}
          onClick={() => setFiltersOpen(true)}
        />
      </div>

      <GschFilterDrawer
        open={filtersOpen}
        title="Filter matches"
        description="Choose the source city for partner recommendations."
        onClose={() => setFiltersOpen(false)}
        footer={
          <>
            <button type="button" className="btn-secondary text-sm" onClick={resetFilters}>
              Reset
            </button>
            <button type="button" className="btn-primary text-sm" onClick={applyFilters}>
              Apply filters
            </button>
          </>
        }
      >
        <div>
          <label className={GSCH_LABEL} htmlFor="gsch-match-city">
            Source city
          </label>
          <select
            id="gsch-match-city"
            className={`${GSCH_SELECT} w-full`}
            value={filters.city_id}
            onChange={(e) => setFilters((f) => ({ ...f, city_id: e.target.value }))}
          >
            <option value="">Select a published city…</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.country}
              </option>
            ))}
          </select>
        </div>
      </GschFilterDrawer>

      {loading ? (
        <div className={`${GSCH_CARD} h-40 animate-pulse`} />
      ) : matches.length === 0 ? (
        <EmptyState
          title="No cached recommendations yet"
          description={
            canRecompute
              ? 'Publish city profile fields, then recompute to score real overlaps with other published cities.'
              : 'Follow or manage a published city, or ask a city manager to recompute matches.'
          }
        />
      ) : (
        <GschDataTable>
          <GschTableHead>
            <GschTableHeadCell>Recommended city</GschTableHeadCell>
            <GschTableHeadCell>Country</GschTableHeadCell>
            <GschTableHeadCell>Score</GschTableHeadCell>
            <GschTableHeadCell>Reasons</GschTableHeadCell>
            <GschTableHeadCell align="right">Actions</GschTableHeadCell>
          </GschTableHead>
          <GschTableBody>
            {matches.map((match) => {
              const city = match.recommended_city
              const score = Number(match.compatibility_score)
              const reasons =
                match.explanation ||
                (match.shared_interests?.length
                  ? match.shared_interests.slice(0, 4).join(', ')
                  : '—')
              return (
                <GschTableRow
                  key={match.id}
                  onClick={
                    city
                      ? () => router.push(`/global-hub/cities/${city.id}`)
                      : undefined
                  }
                >
                  <GschTableCell className="min-w-[140px]">
                    <p className="font-semibold text-content">
                      {city?.name || 'Recommended city'}
                    </p>
                  </GschTableCell>
                  <GschTableCell>
                    {[city?.country, city?.continent].filter(Boolean).join(' · ') ||
                      '—'}
                  </GschTableCell>
                  <GschTableCell>
                    <span className="tabular-nums font-semibold text-primary">
                      {Number.isFinite(score) ? score.toFixed(1) : '—'}
                    </span>
                  </GschTableCell>
                  <GschTableCell className="max-w-[280px]">
                    <p className="line-clamp-2 text-sm text-content-secondary">
                      {reasons}
                    </p>
                  </GschTableCell>
                  <GschTableCell align="right">
                    <GschRowActions
                      onView={
                        city
                          ? () => router.push(`/global-hub/cities/${city.id}`)
                          : undefined
                      }
                      viewLabel="View city"
                      onEdit={() =>
                        router.push(
                          `/global-hub/partnerships?target_city=${match.recommended_city_id}`
                        )
                      }
                      editLabel="Connect"
                    />
                  </GschTableCell>
                </GschTableRow>
              )
            })}
          </GschTableBody>
        </GschDataTable>
      )}
    </div>
  )
}
