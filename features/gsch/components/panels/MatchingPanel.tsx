'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import EmptyState from '@/features/gsch/components/EmptyState'
import MatchCard from '@/features/gsch/components/MatchCard'
import {
  GSCH_CARD,
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
  const { user, loading: authLoading } = useAuth()
  const [cities, setCities] = useState<GschCity[]>([])
  const [cityId, setCityId] = useState(initialCityId || '')
  const [matches, setMatches] = useState<GschMatchRecommendation[]>([])
  const [canRecompute, setCanRecompute] = useState(false)
  const [loading, setLoading] = useState(true)
  const [recomputing, setRecomputing] = useState(false)

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
      setCityId((current) => current || list[0]?.id || '')
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
        setCityId((current) => current || data.city_id || '')
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

  if (authLoading || (loading && matches.length === 0 && !cityId)) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`${GSCH_CARD} h-40 animate-pulse`} />
        ))}
      </div>
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
          zero — nothing is invented.
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

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block min-w-0 flex-1 text-sm">
            <span className="mb-1.5 block text-content-secondary">Source city</span>
            <select
              className={`${GSCH_SELECT} w-full`}
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
            >
              <option value="">Select a published city…</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.country}
                </option>
              ))}
            </select>
          </label>
          {canRecompute ? (
            <button
              type="button"
              className="btn-primary text-sm"
              disabled={!cityId || recomputing}
              onClick={recompute}
            >
              {recomputing ? 'Computing…' : 'Recompute matches'}
            </button>
          ) : null}
        </div>
      </section>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`${GSCH_CARD} h-40 animate-pulse`} />
          ))}
        </div>
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
        <div className="grid gap-4 lg:grid-cols-2">
          {matches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              connectHref={`/global-hub/partnerships?target_city=${match.recommended_city_id}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
