'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import EmptyState from '@/features/gsch/components/EmptyState'
import OpportunityCard from '@/features/gsch/components/OpportunityCard'
import {
  GSCH_CARD,
  GSCH_FIELD,
  GSCH_SECTION_TITLE,
  GSCH_SELECT,
} from '@/features/gsch/constants/styles'
import {
  GSCH_CONTINENTS,
  GSCH_OPPORTUNITY_CATEGORIES,
  type GschCity,
  type GschOpportunity,
  type GschOpportunityCategory,
  type GschOrganization,
  type GschPaginated,
} from '@/shared/types/gsch'

export default function OpportunitiesPanel() {
  const { user, loading: authLoading } = useAuth()
  const [items, setItems] = useState<GschOpportunity[]>([])
  const [orgs, setOrgs] = useState<GschOrganization[]>([])
  const [cities, setCities] = useState<GschCity[]>([])
  const [loading, setLoading] = useState(true)
  const [mine, setMine] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [filters, setFilters] = useState({
    q: '',
    category: '',
    country: '',
    continent: '',
  })
  const [applied, setApplied] = useState(filters)
  const [form, setForm] = useState({
    organization_id: '',
    city_id: '',
    title: '',
    summary: '',
    description: '',
    category: 'grant' as GschOpportunityCategory,
    country: '',
    continent: '',
    location_label: '',
    application_deadline: '',
    external_url: '',
    contact_email: '',
    tags: '',
    is_published: false,
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('limit', '30')
      if (mine) params.set('mine', '1')
      if (applied.q) params.set('q', applied.q)
      if (applied.category) params.set('category', applied.category)
      if (applied.country) params.set('country', applied.country)
      if (applied.continent) params.set('continent', applied.continent)

      const data = await apiClient.get<GschPaginated<GschOpportunity>>(
        `/api/gsch/opportunities?${params.toString()}`
      )
      setItems(data.data || [])
    } catch (err) {
      setItems([])
      toast.error(err instanceof ApiError ? err.message : 'Failed to load opportunities')
    } finally {
      setLoading(false)
    }
  }, [mine, applied])

  const loadMeta = useCallback(async () => {
    try {
      const [orgRes, cityRes] = await Promise.all([
        apiClient.get<GschOrganization[]>('/api/gsch/organizations?mine=1'),
        apiClient.get<GschPaginated<GschCity>>('/api/gsch/cities?mine=1&limit=50'),
      ])
      setOrgs(orgRes || [])
      setCities(cityRes.data || [])
      setForm((f) => ({
        ...f,
        organization_id: f.organization_id || orgRes?.[0]?.id || '',
      }))
    } catch {
      /* optional */
    }
  }, [])

  useEffect(() => {
    if (authLoading || !user) return
    load()
    loadMeta()
  }, [authLoading, user?.id, load, loadMeta])

  async function createOpportunity(e: React.FormEvent) {
    e.preventDefault()
    if (!form.organization_id || !form.title.trim()) {
      toast.error('Organization and title are required')
      return
    }
    setSubmitting(true)
    try {
      await apiClient.post('/api/gsch/opportunities', {
        ...form,
        city_id: form.city_id || null,
        application_deadline: form.application_deadline || null,
        tags: form.tags,
      })
      toast.success('Opportunity created')
      setShowCreate(false)
      setMine(true)
      setForm((f) => ({
        ...f,
        title: '',
        summary: '',
        description: '',
        tags: '',
        is_published: false,
      }))
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Create failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading) {
    return <div className={`${GSCH_CARD} h-40 animate-pulse`} />
  }
  if (!user) return <EmptyState title="Sign in required" />

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input
            className={GSCH_FIELD}
            placeholder="Search…"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          />
          <select
            className={GSCH_SELECT}
            value={filters.category}
            onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
          >
            <option value="">All categories</option>
            {GSCH_OPPORTUNITY_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <input
            className={GSCH_FIELD}
            placeholder="Country"
            value={filters.country}
            onChange={(e) => setFilters((f) => ({ ...f, country: e.target.value }))}
          />
          <select
            className={GSCH_SELECT}
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
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => setApplied(filters)}
          >
            Apply filters
          </button>
          <button
            type="button"
            className={mine ? 'btn-primary text-sm' : 'btn-secondary text-sm'}
            onClick={() => setMine((v) => !v)}
          >
            {mine ? 'My org posts' : 'Discover'}
          </button>
          {orgs.length > 0 ? (
            <button
              type="button"
              className="btn-primary text-sm"
              onClick={() => setShowCreate((v) => !v)}
            >
              {showCreate ? 'Close form' : 'Post opportunity'}
            </button>
          ) : null}
        </div>
      </div>

      {showCreate ? (
        <form onSubmit={createOpportunity} className={`${GSCH_CARD} space-y-3`}>
          <h2 className={GSCH_SECTION_TITLE}>Create opportunity</h2>
          <select
            className={`${GSCH_SELECT} w-full`}
            value={form.organization_id}
            onChange={(e) =>
              setForm((f) => ({ ...f, organization_id: e.target.value }))
            }
            required
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <select
            className={`${GSCH_SELECT} w-full`}
            value={form.city_id}
            onChange={(e) => setForm((f) => ({ ...f, city_id: e.target.value }))}
          >
            <option value="">City (optional)</option>
            {cities
              .filter((c) => c.organization_id === form.organization_id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
          <select
            className={`${GSCH_SELECT} w-full`}
            value={form.category}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                category: e.target.value as GschOpportunityCategory,
              }))
            }
          >
            {GSCH_OPPORTUNITY_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <input
            className={GSCH_FIELD}
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
          />
          <input
            className={GSCH_FIELD}
            placeholder="Summary"
            value={form.summary}
            onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
          />
          <textarea
            className={GSCH_FIELD}
            rows={3}
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              className={GSCH_FIELD}
              placeholder="Country"
              value={form.country}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
            />
            <select
              className={GSCH_SELECT}
              value={form.continent}
              onChange={(e) => setForm((f) => ({ ...f, continent: e.target.value }))}
            >
              <option value="">Continent</option>
              {GSCH_CONTINENTS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              className={GSCH_FIELD}
              placeholder="Location label"
              value={form.location_label}
              onChange={(e) =>
                setForm((f) => ({ ...f, location_label: e.target.value }))
              }
            />
          </div>
          <input
            className={GSCH_FIELD}
            type="date"
            value={form.application_deadline}
            onChange={(e) =>
              setForm((f) => ({ ...f, application_deadline: e.target.value }))
            }
          />
          <input
            className={GSCH_FIELD}
            placeholder="External URL"
            value={form.external_url}
            onChange={(e) => setForm((f) => ({ ...f, external_url: e.target.value }))}
          />
          <input
            className={GSCH_FIELD}
            placeholder="Contact email"
            value={form.contact_email}
            onChange={(e) =>
              setForm((f) => ({ ...f, contact_email: e.target.value }))
            }
          />
          <input
            className={GSCH_FIELD}
            placeholder="Tags (comma-separated)"
            value={form.tags}
            onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm text-content-secondary">
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={(e) =>
                setForm((f) => ({ ...f, is_published: e.target.checked }))
              }
            />
            Publish immediately
          </label>
          <button type="submit" className="btn-primary text-sm" disabled={submitting}>
            {submitting ? 'Saving…' : 'Create'}
          </button>
        </form>
      ) : null}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`${GSCH_CARD} h-36 animate-pulse`} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title={mine ? 'No opportunities from your orgs' : 'No published opportunities'}
          description="Post a grant, conference, trade mission, or sister-city call."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <OpportunityCard
              key={item.id}
              opportunity={item}
              showPublishState={mine}
            />
          ))}
        </div>
      )}
    </div>
  )
}
