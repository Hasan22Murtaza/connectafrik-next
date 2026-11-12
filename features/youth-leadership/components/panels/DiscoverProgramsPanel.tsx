'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Filter, Search } from '@/shared/icons'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import YouthFilterDrawer from '@/features/youth-leadership/components/YouthFilterDrawer'
import ProgramCard from '@/features/youth-leadership/components/ProgramCard'
import EmptyState from '@/features/youth-leadership/components/EmptyState'
import YouthSkeleton from '@/features/youth-leadership/components/YouthSkeleton'
import YouthSectionHeader from '@/features/youth-leadership/components/YouthSectionHeader'
import { YOUTH_FIELD } from '@/features/youth-leadership/components/YouthFormModal'
import type {
  YouthProgram,
  YouthProgramCategory,
  YouthProgramFormat,
} from '@/shared/types/youthLeadership'

type ProgramsPayload = {
  data: YouthProgram[]
  page: number
  pageSize: number
  hasMore: boolean
}

const FORMATS: { value: '' | YouthProgramFormat; label: string }[] = [
  { value: '', label: 'Any format' },
  { value: 'online', label: 'Online / Virtual' },
  { value: 'in_person', label: 'In person' },
  { value: 'hybrid', label: 'Hybrid' },
]

const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'deadline', label: 'Deadline' },
  { value: 'popularity', label: 'Popularity' },
]

export default function DiscoverProgramsPanel() {
  const { user, loading: authLoading } = useAuth()
  const [categories, setCategories] = useState<YouthProgramCategory[]>([])
  const [programs, setPrograms] = useState<YouthProgram[]>([])
  const [loading, setLoading] = useState(true)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [category, setCategory] = useState('')
  const [age, setAge] = useState('')
  const [skill, setSkill] = useState('')
  const [format, setFormat] = useState('')
  const [deadline, setDeadline] = useState('')
  const [country, setCountry] = useState('')
  const [region, setRegion] = useState('')
  const [sort, setSort] = useState('newest')

  const loadCategories = useCallback(async () => {
    try {
      const data = await apiClient.get<YouthProgramCategory[]>(
        '/api/youth-leadership/categories'
      )
      setCategories(Array.isArray(data) ? data : [])
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load categories')
    }
  }, [])

  const loadPrograms = useCallback(async () => {
    setLoading(true)
    try {
      const payload = await apiClient.get<ProgramsPayload>(
        '/api/youth-leadership/programs',
        {
          search: search || undefined,
          category: category || undefined,
          age: age || undefined,
          skill: skill || undefined,
          format: format || undefined,
          deadline_before: deadline || undefined,
          country: country || undefined,
          region: region || undefined,
          sort,
          limit: 40,
        }
      )
      setPrograms(payload?.data || [])
    } catch (err) {
      setPrograms([])
      toast.error(err instanceof ApiError ? err.message : 'Failed to load programs')
    } finally {
      setLoading(false)
    }
  }, [search, category, age, skill, format, deadline, country, region, sort])

  useEffect(() => {
    if (authLoading || !user) return
    loadCategories()
  }, [authLoading, user, loadCategories])

  useEffect(() => {
    if (authLoading || !user) return
    loadPrograms()
  }, [authLoading, user, loadPrograms])

  function resetFilters() {
    setSearch('')
    setSearchInput('')
    setCategory('')
    setAge('')
    setSkill('')
    setFormat('')
    setDeadline('')
    setCountry('')
    setRegion('')
    setSort('newest')
  }

  const activeFilterCount = useMemo(() => {
    return [category, age, skill, format, deadline, country, region].filter(Boolean)
      .length
  }, [category, age, skill, format, deadline, country, region])

  const trending = categories.slice(0, 6)

  if (authLoading) {
    return <YouthSkeleton count={6} />
  }

  if (!user) {
    return (
      <EmptyState
        title="Sign in to explore programs"
        description="Youth Leadership programs require an authenticated ConnectAfrik account."
      />
    )
  }

  return (
    <>
      <section className="mb-6 space-y-3">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-center"
          onSubmit={(e) => {
            e.preventDefault()
            setSearch(searchInput.trim())
          }}
        >
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search programs</span>
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-tertiary"
              aria-hidden
            />
            <input
              className={`${YOUTH_FIELD} h-11 rounded-xl border-border/80 bg-surface pl-10 shadow-[0_1px_2px_rgba(15,23,42,0.04)]`}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search programs, skills, or organizations…"
            />
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="relative inline-flex h-11 items-center gap-2 rounded-xl border border-border/80 bg-surface px-3.5 text-sm font-medium text-content shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-primary/40 hover:text-primary"
              aria-expanded={filtersOpen}
              aria-controls="youth-filters-drawer"
            >
              <Filter className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Filters</span>
              {activeFilterCount > 0 ? (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>

            <button type="submit" className="btn-primary h-11 shrink-0 px-5">
              Explore
            </button>
          </div>
        </form>

        {trending.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {trending.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  category === c.slug
                    ? 'bg-primary text-white'
                    : 'bg-surface text-content-secondary ring-1 ring-border/80 hover:text-content hover:ring-primary/35'
                }`}
                onClick={() => setCategory(category === c.slug ? '' : c.slug)}
              >
                #{c.name.replace(/\s+/g, '')}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <YouthSectionHeader
        title="Open Leadership Cohorts"
        badge={
          !loading ? (
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              {programs.length} Active
            </span>
          ) : null
        }
      >
        <label className="sr-only" htmlFor="youth-sort">
          Sort
        </label>
        <select
          id="youth-sort"
          className="h-9 rounded-lg border border-border/80 bg-surface px-3 text-xs font-medium text-content outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </YouthSectionHeader>

      {loading ? (
        <YouthSkeleton count={6} />
      ) : programs.length === 0 ? (
        <EmptyState
          title="No programs found"
          description="Try adjusting filters, or check back later when organizations publish new opportunities."
          action={
            <button type="button" className="btn-secondary" onClick={resetFilters}>
              Clear filters
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {programs.map((program) => (
            <ProgramCard key={program.id} program={program} />
          ))}
        </div>
      )}

      <YouthFilterDrawer
        open={filtersOpen}
        title="Filter programs"
        description="Narrow by age, skills, format, location, and deadline."
        onClose={() => setFiltersOpen(false)}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={resetFilters}>
              Reset
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setFiltersOpen(false)}
            >
              Show results
            </button>
          </>
        }
      >
        <div id="youth-filters-drawer" className="space-y-4">
          <div>
            <label className="text-xs font-medium text-content-secondary">Category</label>
            <select
              className={`${YOUTH_FIELD} mt-1.5`}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-content-secondary">
              Age eligibility
            </label>
            <input
              className={`${YOUTH_FIELD} mt-1.5`}
              type="number"
              min={1}
              max={120}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="e.g. 16"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-content-secondary">
              Delivery format
            </label>
            <select
              className={`${YOUTH_FIELD} mt-1.5`}
              value={format}
              onChange={(e) => setFormat(e.target.value)}
            >
              {FORMATS.map((f) => (
                <option key={f.value || 'any'} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-content-secondary">Skill</label>
            <input
              className={`${YOUTH_FIELD} mt-1.5`}
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
              placeholder="e.g. public speaking"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-content-secondary">
              Deadline before
            </label>
            <input
              className={`${YOUTH_FIELD} mt-1.5`}
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-content-secondary">
              Region / location
            </label>
            <input
              className={`${YOUTH_FIELD} mt-1.5`}
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="City or region"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-content-secondary">Country</label>
            <input
              className={`${YOUTH_FIELD} mt-1.5`}
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="Country"
            />
          </div>
        </div>
      </YouthFilterDrawer>
    </>
  )
}
