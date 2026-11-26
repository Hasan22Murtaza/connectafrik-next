'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import CityCard from '@/features/gsch/components/CityCard'
import EmptyState from '@/features/gsch/components/EmptyState'
import GschFilterDrawer from '@/features/gsch/components/GschFilterDrawer'
import GschFiltersButton, {
  countActiveFilters,
} from '@/features/gsch/components/GschFiltersButton'
import GschHubTabs from '@/features/gsch/components/GschHubTabs'
import GschSearchBar from '@/features/gsch/components/GschSearchBar'
import GschSectionHeader from '@/features/gsch/components/GschSectionHeader'
import GschSkeleton from '@/features/gsch/components/GschSkeleton'
import GschWorldMap from '@/features/gsch/components/GschWorldMap'
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
  GSCH_COUNT_BADGE,
  GSCH_FIELD,
  GSCH_LABEL,
  GSCH_SELECT,
  GSCH_TOOLBAR,
} from '@/features/gsch/constants/styles'
import { LayoutGrid, List, MapPin } from '@/shared/icons'
import { GSCH_CONTINENTS } from '@/shared/types/gsch'
import type { GschCity, GschPaginated } from '@/shared/types/gsch'

type ViewMode = 'cards' | 'list' | 'map'
type BrowseTab = 'all' | 'saved'

export default function DiscoverCitiesPanel() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [cities, setCities] = useState<GschCity[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [view, setView] = useState<ViewMode>('cards')
  const [tab, setTab] = useState<BrowseTab>('all')
  const [filters, setFilters] = useState({
    q: '',
    country: '',
    continent: '',
    industry: '',
    savedOnly: false,
  })
  const [applied, setApplied] = useState(filters)
  const [followBusyId, setFollowBusyId] = useState<string | null>(null)

  const activeFilterCount = countActiveFilters({
    ...applied,
    savedOnly: false,
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const payload = await apiClient.get<GschPaginated<GschCity>>('/api/gsch/cities', {
        q: applied.q || undefined,
        country: applied.country || undefined,
        continent: applied.continent || undefined,
        industry: applied.industry || undefined,
        saved: applied.savedOnly || tab === 'saved' ? '1' : undefined,
        page,
        limit: view === 'map' ? 50 : 12,
      })
      setCities(payload?.data || [])
      setHasMore(Boolean(payload?.hasMore))
    } catch (err) {
      setCities([])
      toast.error(err instanceof ApiError ? err.message : 'Failed to load cities')
    } finally {
      setLoading(false)
    }
  }, [applied, page, tab, view])

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
    return <GschSkeleton variant="card" count={6} />
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <GschHubTabs
          tabs={[
            { id: 'all', label: 'All cities' },
            { id: 'saved', label: 'Saved' },
          ]}
          activeId={tab}
          onChange={(id) => {
            setTab(id as BrowseTab)
            setPage(0)
          }}
          aria-label="City browse views"
        />
        <div className="flex items-center gap-1 rounded-full bg-surface-secondary/80 p-1">
          {(
            [
              { id: 'cards', icon: LayoutGrid, label: 'Cards' },
              { id: 'list', icon: List, label: 'List' },
              { id: 'map', icon: MapPin, label: 'Map' },
            ] as const
          ).map((opt) => {
            const Icon = opt.icon
            const active = view === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                aria-label={opt.label}
                aria-pressed={active}
                onClick={() => {
                  setView(opt.id)
                  setPage(0)
                }}
                className={
                  active
                    ? 'flex h-8 w-8 items-center justify-center rounded-full bg-surface text-content shadow-sm'
                    : 'flex h-8 w-8 items-center justify-center rounded-full text-content-secondary transition hover:text-content'
                }
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </button>
            )
          })}
        </div>
      </div>

      <div className={GSCH_TOOLBAR} data-tour="gsch-filters">
        <GschSearchBar
          value={filters.q}
          onChange={(q) => setFilters((f) => ({ ...f, q }))}
          onSubmit={applyFilters}
          placeholder="Search cities, countries, or descriptions…"
          className="w-full sm:max-w-md"
        />
        <GschFiltersButton
          activeCount={activeFilterCount}
          onClick={() => setFiltersOpen(true)}
        />
      </div>

      <GschFilterDrawer
        open={filtersOpen}
        title="Filter cities"
        description="Narrow discover results by location, industry, or region."
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
      </GschFilterDrawer>

      {loading ? (
        <GschSkeleton
          variant={view === 'list' ? 'table' : 'card'}
          count={view === 'list' ? 5 : 6}
        />
      ) : cities.length === 0 ? (
        <EmptyState
          title="No cities found"
          description="Broaden your search or filters—or publish a city profile so others can discover your community."
        />
      ) : (
        <>
          <GschSectionHeader
            title={tab === 'saved' ? 'Saved cities' : 'Cities'}
            badge={<span className={GSCH_COUNT_BADGE}>{cities.length}</span>}
          />

          {view === 'map' ? (
            <GschWorldMap cities={cities} autoLoadConnections />
          ) : view === 'cards' ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
        </>
      )}

      {(page > 0 || hasMore) && !loading && view !== 'map' ? (
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
