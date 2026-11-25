'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { LayoutGrid, List, Search } from '@/shared/icons'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import CityCard from '@/features/gsch/components/CityCard'
import EmptyState from '@/features/gsch/components/EmptyState'
import {
  GSCH_CARD,
  GSCH_CHIP,
  GSCH_FIELD,
  GSCH_SELECT,
} from '@/features/gsch/constants/styles'
import { GSCH_CONTINENTS } from '@/shared/types/gsch'
import type { GschCity, GschPaginated } from '@/shared/types/gsch'

export default function DiscoverCitiesPanel() {
  const { user, loading: authLoading } = useAuth()
  const [cities, setCities] = useState<GschCity[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [searchInput, setSearchInput] = useState('')
  const [q, setQ] = useState('')
  const [country, setCountry] = useState('')
  const [continent, setContinent] = useState('')
  const [industry, setIndustry] = useState('')
  const [savedOnly, setSavedOnly] = useState(false)
  const [followBusyId, setFollowBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const payload = await apiClient.get<GschPaginated<GschCity>>('/api/gsch/cities', {
        q: q || undefined,
        country: country || undefined,
        continent: continent || undefined,
        industry: industry || undefined,
        saved: savedOnly ? '1' : undefined,
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
  }, [q, country, continent, industry, savedOnly, page])

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
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          setPage(0)
          setQ(searchInput.trim())
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search cities</span>
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-tertiary"
              aria-hidden
            />
            <input
              className={`${GSCH_FIELD} h-11 pl-10`}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search cities, countries, or descriptions…"
            />
          </label>
          <button type="submit" className="btn-primary h-11 shrink-0 px-5">
            Search
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="gsch-continent">
            Continent
          </label>
          <select
            id="gsch-continent"
            className={GSCH_SELECT}
            value={continent}
            onChange={(e) => {
              setPage(0)
              setContinent(e.target.value)
            }}
          >
            <option value="">All continents</option>
            {GSCH_CONTINENTS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="gsch-country">
            Country
          </label>
          <input
            id="gsch-country"
            className={`${GSCH_FIELD} max-w-[10rem]`}
            placeholder="Country"
            value={country}
            onChange={(e) => {
              setPage(0)
              setCountry(e.target.value)
            }}
          />

          <label className="sr-only" htmlFor="gsch-industry">
            Industry
          </label>
          <input
            id="gsch-industry"
            className={`${GSCH_FIELD} max-w-[10rem]`}
            placeholder="Industry"
            value={industry}
            onChange={(e) => {
              setPage(0)
              setIndustry(e.target.value)
            }}
          />

          <button
            type="button"
            className={savedOnly ? 'btn-primary text-sm' : 'btn-secondary text-sm'}
            onClick={() => {
              setPage(0)
              setSavedOnly((v) => !v)
            }}
          >
            Saved only
          </button>

          <div className="ml-auto flex items-center gap-1 rounded-lg border border-border p-1">
            <button
              type="button"
              aria-label="Grid view"
              className={`rounded-md p-1.5 ${view === 'grid' ? 'bg-surface-secondary text-content' : 'text-content-secondary'}`}
              onClick={() => setView('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="List view"
              className={`rounded-md p-1.5 ${view === 'list' ? 'bg-surface-secondary text-content' : 'text-content-secondary'}`}
              onClick={() => setView('list')}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </form>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`${GSCH_CARD} h-56 animate-pulse`} />
          ))}
        </div>
      ) : cities.length === 0 ? (
        <EmptyState
          title="No cities found"
          description="Try adjusting filters, or create and publish a city profile for your organization."
        />
      ) : view === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cities.map((city) => (
            <CityCard
              key={city.id}
              city={city}
              onToggleFollow={toggleFollow}
              followBusy={followBusyId === city.id}
            />
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {cities.map((city) => (
            <li key={city.id} className={`${GSCH_CARD} flex flex-wrap items-center gap-3`}>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/global-hub/cities/${city.id}`}
                  className="font-semibold text-content hover:text-primary"
                >
                  {city.name}
                </Link>
                <p className="mt-0.5 text-xs text-content-tertiary">
                  {[city.state_province, city.country].filter(Boolean).join(', ')}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(city.major_industries || []).slice(0, 3).map((ind) => (
                    <span key={ind} className={GSCH_CHIP}>
                      {ind}
                    </span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                className={city.is_followed ? 'btn-secondary text-sm' : 'btn-primary text-sm'}
                disabled={followBusyId === city.id}
                onClick={() => toggleFollow(city)}
              >
                {city.is_followed ? 'Saved' : 'Save'}
              </button>
            </li>
          ))}
        </ul>
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
