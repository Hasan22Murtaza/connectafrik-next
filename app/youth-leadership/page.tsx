'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import YouthShell from '@/features/youth-leadership/components/YouthShell'
import ProgramCard from '@/features/youth-leadership/components/ProgramCard'
import EmptyState from '@/features/youth-leadership/components/EmptyState'
import { YOUTH_CARD } from '@/features/youth-leadership/constants/nav'
import type {
  YouthProgram,
  YouthProgramCategory,
  YouthProgramFormat,
} from '@/shared/types/youthLeadership'

const FIELD =
  'w-full rounded-lg border border-border bg-surface-primary px-3 py-2 text-sm text-content-primary outline-none focus:border-primary'

type ProgramsPayload = {
  data: YouthProgram[]
  page: number
  pageSize: number
  hasMore: boolean
}

const FORMATS: { value: '' | YouthProgramFormat; label: string }[] = [
  { value: '', label: 'Any format' },
  { value: 'online', label: 'Online' },
  { value: 'in_person', label: 'In person' },
  { value: 'hybrid', label: 'Hybrid' },
]

const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'deadline', label: 'Deadline' },
  { value: 'popularity', label: 'Popularity' },
]

export default function YouthLeadershipDiscoverPage() {
  const { user, loading: authLoading } = useAuth()
  const [categories, setCategories] = useState<YouthProgramCategory[]>([])
  const [programs, setPrograms] = useState<YouthProgram[]>([])
  const [loading, setLoading] = useState(true)
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

  if (authLoading) {
    return (
      <YouthShell title="Discover Programs" subtitle="Loading…">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`${YOUTH_CARD} h-40 animate-pulse bg-surface-secondary`} />
          ))}
        </div>
      </YouthShell>
    )
  }

  if (!user) {
    return (
      <YouthShell title="Discover Programs">
        <EmptyState
          title="Sign in to explore programs"
          description="Youth Leadership programs require an authenticated ConnectAfrik account."
        />
      </YouthShell>
    )
  }

  return (
    <YouthShell
      title="Discover Programs"
      subtitle="Find leadership programs that match your age, skills, and community goals."
    >
      <section className={`${YOUTH_CARD} mb-6`}>
        <h2 className="text-base font-semibold text-content-primary">
          Search &amp; filters
        </h2>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault()
            setSearch(searchInput.trim())
          }}
        >
          <div className="sm:col-span-2 lg:col-span-2">
            <label className="text-xs font-medium text-content-secondary">Search</label>
            <input
              className={`${FIELD} mt-1`}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Program title, description…"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-content-secondary">Category</label>
            <select
              className={`${FIELD} mt-1`}
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
            <label className="text-xs font-medium text-content-secondary">Age</label>
            <input
              className={`${FIELD} mt-1`}
              type="number"
              min={1}
              max={120}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="e.g. 16"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-content-secondary">Skill</label>
            <input
              className={`${FIELD} mt-1`}
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
              placeholder="e.g. public speaking"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-content-secondary">
              Format (online / in-person)
            </label>
            <select
              className={`${FIELD} mt-1`}
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
            <label className="text-xs font-medium text-content-secondary">
              Deadline before
            </label>
            <input
              className={`${FIELD} mt-1`}
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-content-secondary">Country</label>
            <input
              className={`${FIELD} mt-1`}
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="Country"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-content-secondary">Region</label>
            <input
              className={`${FIELD} mt-1`}
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="City / region"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-content-secondary">Sort</label>
            <select
              className={`${FIELD} mt-1`}
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
            <button type="submit" className="btn-primary">
              Apply filters
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
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
              }}
            >
              Reset
            </button>
          </div>
        </form>
      </section>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`${YOUTH_CARD} h-40 animate-pulse bg-surface-secondary`} />
          ))}
        </div>
      ) : programs.length === 0 ? (
        <EmptyState
          title="No programs found"
          description="Try adjusting filters, or check back later when organizations publish new opportunities."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((program) => (
            <ProgramCard key={program.id} program={program} />
          ))}
        </div>
      )}
    </YouthShell>
  )
}
