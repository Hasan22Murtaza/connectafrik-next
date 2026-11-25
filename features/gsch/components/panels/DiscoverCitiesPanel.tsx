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
  GSCH_FIELD,
  GSCH_LABEL,
  GSCH_SELECT,
} from '@/features/gsch/constants/styles'
import { GSCH_CONTINENTS } from '@/shared/types/gsch'
import type { GschCity, GschPaginated } from '@/shared/types/gsch'

export default function DiscoverCitiesPanel() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [cities, setCities] = useState<GschCity[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState({
    q: '',
    country: '',
    continent: '',
    industry: '',
    savedOnly: false,
  })
  const [applied, setApplied] = useState(filters)
  const [followBusyId, setFollowBusyId] = useState<string | null>(null)

  const activeFilterCount = countActiveFilters(applied)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const payload = await apiClient.get<GschPaginated<GschCity>>('/api/gsch/cities', {
        q: applied.q || undefined,
        country: applied.country || undefined,
        continent: applied.continent || undefined,
        industry: applied.industry || undefined,
        saved: applied.savedOnly ? '1' : undefined,
        page,
        limit: 12,
      })
      setCities(payload?.data || [])
      setHasMore(Boolean(payload?.hasMore))
    } catch (err) {
      setCities([])
      toast.error(err instanceof ApiError ? err.message : 'Failed to load cities')
    } finally {
      setLoading(false)
    }
  }, [applied, page])

  useEffect(() => {
    if (authLoading || !user) return
    load()
  }, [authLoading, user?.id, load])

  async function toggleFollow(city: GschCity) {
    setFollowBusyId(city.id)
    try {
      const result = await apiClient.post<{ followed: boolean }>(
        `/api/gsch/cities/${city.id}/follow`
      )
      setCities((prev) =>
        prev.map((c) =>
          c.id === city.id ? { ...c, is_followed: result.followed } : c
        )
      )
      toast.success(result.followed ? 'City saved' : 'Removed from saved')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update saved city')
    } finally {
      setFollowBusyId(null)
    }
  }

  function applyFilters() {
    setPage(0)
    setApplied(filters)
    setFiltersOpen(false)
  }

  function resetFilters() {
    const empty = {
      q: '',
      country: '',
      continent: '',
      industry: '',
      savedOnly: false,
    }
    setFilters(empty)
    setApplied(empty)
    setPage(0)
    setFiltersOpen(false)
  }

  if (authLoading) {
    return <div className={`${GSCH_CARD} h-40 animate-pulse`} />
  }

  if (!user) {
    return (
      <EmptyState
        title="Sign in to discover cities"
        description="Browse published city profiles across the Global Sister Cities Hub."
      />
    )
  }

  return (
    <div className="space-y-5">
      <div
        className="flex flex-wrap items-center justify-end gap-3"
        data-tour="gsch-filters"
      >
        <GschFiltersButton
          activeCount={activeFilterCount}
          onClick={() => setFiltersOpen(true)}
        />
      </div>

      <GschFilterDrawer
        open={filtersOpen}
        title="Filter cities"
        description="Narrow discover results by location, industry, or saved status."
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
          <label className={GSCH_LABEL} htmlFor="gsch-discover-q">
            Search
          </label>
          <input
            id="gsch-discover-q"
            className={GSCH_FIELD}
            placeholder="Cities, countries, or descriptions…"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          />
        </div>
        <div>
          <label className={GSCH_LABEL} htmlFor="gsch-discover-country">
            Country
          </label>
          <input
            id="gsch-discover-country"
            className={GSCH_FIELD}
            placeholder="Country"
            value={filters.country}
            onChange={(e) => setFilters((f) => ({ ...f, country: e.target.value }))}
          />
        </div>
        <div>
          <label className={GSCH_LABEL} htmlFor="gsch-discover-continent">
            Continent
          </label>
          <select
            id="gsch-discover-continent"
            className={`${GSCH_SELECT} w-full`}
            value={filters.continent}
            onChange={(e) => setFilters((f) => ({ ...f, continent: e.target.value }))}
          >
            <option value="">All continents</option>
            {GSCH_CONTINENTS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={GSCH_LABEL} htmlFor="gsch-discover-industry">
            Industry
          </label>
          <input
            id="gsch-discover-industry"
            className={GSCH_FIELD}
            placeholder="Industry"
            value={filters.industry}
            onChange={(e) => setFilters((f) => ({ ...f, industry: e.target.value }))}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-content-secondary">
          <input
            type="checkbox"
            checked={filters.savedOnly}
            onChange={(e) =>
              setFilters((f) => ({ ...f, savedOnly: e.target.checked }))
            }
          />
          Saved only
        </label>
      </GschFilterDrawer>

            {loading ? (
        <div className={`${GSCH_CARD} h-40 animate-pulse`} />
      ) : cities.length === 0 ? (
        <EmptyState
          title="No cities found"
          description="Try adjusting filters, or create and publish a city profile for your organization."
        />
      ) : (
        <GschDataTable>
          <GschTableHead>
            <GschTableHeadCell>City</GschTableHeadCell>
            <GschTableHeadCell>Country / Continent</GschTableHeadCell>
            <GschTableHeadCell>Industries</GschTableHeadCell>
            <GschTableHeadCell>Saved</GschTableHeadCell>
            <GschTableHeadCell align="right">Actions</GschTableHeadCell>
          </GschTableHead>
          <GschTableBody>
            {cities.map((city) => {
              const industries = (city.major_industries || []).slice(0, 3).join(', ')
              const followBusy = followBusyId === city.id
              return (
                <GschTableRow
                  key={city.id}
                  onClick={() => router.push(`/global-hub/cities/${city.id}`)}
                >
                  <GschTableCell className="min-w-[140px]">
                    <p className="font-semibold text-content">{city.name}</p>
                    {city.state_province ? (
                      <p className="mt-0.5 text-xs text-content-tertiary">
                        {city.state_province}
                      </p>
                    ) : null}
                  </GschTableCell>
                  <GschTableCell>
                    {[city.country, city.continent].filter(Boolean).join(' · ') || '—'}
                  </GschTableCell>
                  <GschTableCell>{industries || '—'}</GschTableCell>
                  <GschTableCell>{city.is_followed ? 'Yes' : '—'}</GschTableCell>
                  <GschTableCell align="right">
                    <GschRowActions
                      onView={() => router.push(`/global-hub/cities/${city.id}`)}
                      onSave={() => toggleFollow(city)}
                      saveLabel={city.is_followed ? 'Unsave' : 'Save'}
                      saving={followBusy}
                    />
                  </GschTableCell>
                </GschTableRow>
              )
            })}
          </GschTableBody>
        </GschDataTable>
      )}

      {(page > 0 || hasMore) && !loading ? (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            className="btn-secondary text-sm"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Previous
          </button>
          <span className="text-sm text-content-secondary">Page {page + 1}</span>
          <button
            type="button"
            className="btn-secondary text-sm"
            disabled={!hasMore}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  )
}
