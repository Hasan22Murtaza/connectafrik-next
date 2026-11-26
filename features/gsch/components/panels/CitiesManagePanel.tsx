'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import EmptyState from '@/features/gsch/components/EmptyState'
import GschFormModal from '@/features/gsch/components/GschFormModal'
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
import StatusBadge from '@/features/gsch/components/StatusBadge'
import { useConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import {
  GSCH_COUNT_BADGE,
  GSCH_FIELD,
  GSCH_LABEL,
  GSCH_TOOLBAR,
} from '@/features/gsch/constants/styles'
import {
  GSCH_CONTINENTS,
  type GschCity,
  type GschOrganization,
  type GschPaginated,
} from '@/shared/types/gsch'

const EMPTY_FORM = {
  organization_id: '',
  name: '',
  country: '',
  continent: '',
  state_province: '',
  description: '',
  population: '',
  official_website: '',
  mayor_name: '',
  major_industries: '',
  collaboration_interests: '',
  is_published: false,
}

export default function CitiesManagePanel() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { confirm, dialog } = useConfirmDialog()
  const [cities, setCities] = useState<GschCity[]>([])
  const [orgs, setOrgs] = useState<GschOrganization[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [view, setView] = useState<'list' | 'map'>('list')
  const [filters, setFilters] = useState({ q: '', country: '' })
  const [applied, setApplied] = useState(filters)
  const [form, setForm] = useState(EMPTY_FORM)

  const activeFilterCount = countActiveFilters(applied)

  const load = useCallback(async () => {
    const params: Record<string, string | number> = { mine: '1', limit: 50 }
    if (applied.q) params.q = applied.q
    if (applied.country) params.country = applied.country
    const [cityPayload, orgData] = await Promise.all([
      apiClient.get<GschPaginated<GschCity>>('/api/gsch/cities', params),
      apiClient.get<GschOrganization[]>('/api/gsch/organizations'),
    ])
    setCities(cityPayload?.data || [])
    const orgList = Array.isArray(orgData) ? orgData : []
    setOrgs(orgList)
    setForm((f) => ({
      ...f,
      organization_id: f.organization_id || orgList[0]?.id || '',
    }))
  }, [applied])

  useEffect(() => {
    if (authLoading || !user) return
    ;(async () => {
      setLoading(true)
      try {
        await load()
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Failed to load cities')
      } finally {
        setLoading(false)
      }
    })()
  }, [authLoading, user?.id, load])

  function openCreate() {
    setEditingId(null)
    setForm({
      ...EMPTY_FORM,
      organization_id: orgs[0]?.id || '',
    })
    setShowForm(true)
  }

  function openEdit(city: GschCity) {
    setEditingId(city.id)
    setForm({
      organization_id: city.organization_id || '',
      name: city.name || '',
      country: city.country || '',
      continent: city.continent || '',
      state_province: city.state_province || '',
      description: city.description || '',
      population: city.population != null ? String(city.population) : '',
      official_website: city.official_website || '',
      mayor_name: city.mayor_name || '',
      major_industries: (city.major_industries || []).join(', '),
      collaboration_interests: (city.collaboration_interests || []).join(', '),
      is_published: city.is_published,
    })
    setShowForm(true)
  }

  async function save() {
    if (!form.name.trim() || !form.country.trim()) {
      toast.error('Name and country are required')
      return
    }
    setBusy(true)
    const payload = {
      organization_id: form.organization_id || null,
      name: form.name.trim(),
      country: form.country.trim(),
      continent: form.continent || null,
      state_province: form.state_province.trim() || null,
      description: form.description.trim() || null,
      population: form.population ? Number(form.population) : null,
      official_website: form.official_website.trim() || null,
      mayor_name: form.mayor_name.trim() || null,
      major_industries: form.major_industries,
      collaboration_interests: form.collaboration_interests,
      is_published: form.is_published,
    }
    try {
      if (editingId) {
        await apiClient.patch(`/api/gsch/cities/${editingId}`, payload)
        toast.success('City profile updated')
      } else {
        await apiClient.post('/api/gsch/cities', payload)
        toast.success('City profile created')
      }
      setShowForm(false)
      setEditingId(null)
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to save city')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(city: GschCity) {
    const ok = await confirm({
      title: 'Delete city profile?',
      message: `Delete “${city.name}”? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (!ok) return
    setDeletingId(city.id)
    try {
      await apiClient.delete(`/api/gsch/cities/${city.id}`)
      toast.success('City profile deleted')
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  async function togglePublish(city: GschCity) {
    setPublishingId(city.id)
    try {
      const updated = await apiClient.patch<GschCity>(
        `/api/gsch/cities/${city.id}`,
        { is_published: !city.is_published }
      )
      toast.success(updated.is_published ? 'Published' : 'Unpublished')
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Update failed')
    } finally {
      setPublishingId(null)
    }
  }

  function applyFilters() {
    setApplied(filters)
    setFiltersOpen(false)
  }

  function resetFilters() {
    const empty = { q: '', country: '' }
    setFilters(empty)
    setApplied(empty)
    setFiltersOpen(false)
  }

  if (authLoading || loading) {
    return <GschSkeleton variant="table" />
  }

  if (!user) {
    return (
      <EmptyState
        title="Sign in required"
        description="Sign in to create and manage city profiles for your organizations."
      />
    )
  }

  return (
    <div className="space-y-5">
      {dialog}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <GschHubTabs
          tabs={[
            { id: 'list', label: 'Directory' },
            { id: 'map', label: 'Map' },
          ]}
          activeId={view}
          onChange={(id) => setView(id as 'list' | 'map')}
          aria-label="City views"
        />
      </div>
      <div className={GSCH_TOOLBAR}>
        <GschSearchBar
          value={filters.q}
          onChange={(q) => setFilters((f) => ({ ...f, q }))}
          onSubmit={applyFilters}
          placeholder="Search city profiles by name…"
          className="w-full sm:max-w-md"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-primary text-sm"
            data-tour="gsch-primary-cta"
            onClick={openCreate}
          >
            New city profile
          </button>
          <GschFiltersButton
            activeCount={activeFilterCount}
            onClick={() => setFiltersOpen(true)}
          />
        </div>
      </div>

      <GschFilterDrawer
        open={filtersOpen}
        title="Filter cities"
        description="Search your city profiles by name or country."
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
          <label className={GSCH_LABEL} htmlFor="gsch-city-manage-q">
            Search
          </label>
          <input
            id="gsch-city-manage-q"
            className={GSCH_FIELD}
            placeholder="Name or description…"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          />
        </div>
        <div>
          <label className={GSCH_LABEL} htmlFor="gsch-city-manage-country">
            Country
          </label>
          <input
            id="gsch-city-manage-country"
            className={GSCH_FIELD}
            placeholder="Country"
            value={filters.country}
            onChange={(e) => setFilters((f) => ({ ...f, country: e.target.value }))}
          />
        </div>
      </GschFilterDrawer>

            <GschFormModal
        open={showForm}
        title={editingId ? 'Edit city profile' : 'Create city profile'}
        onClose={() => {
          setShowForm(false)
          setEditingId(null)
        }}
        footer={
          <>
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={busy}
              onClick={() => {
                setShowForm(false)
                setEditingId(null)
              }}
            >
              Cancel
            </button>
            <button type="button" className="btn-primary text-sm" disabled={busy} onClick={save}>
              {busy ? 'Saving…' : editingId ? 'Save changes' : 'Create city'}
            </button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="gsch-city-org" className="mb-1 block text-sm font-medium text-content">
              Organization
            </label>
            <select
              id="gsch-city-org"
              className={GSCH_FIELD}
              value={form.organization_id}
              onChange={(e) => setForm((f) => ({ ...f, organization_id: e.target.value }))}
            >
              <option value="">No organization</option>
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="gsch-city-name" className="mb-1 block text-sm font-medium text-content">
              City name
            </label>
            <input
              id="gsch-city-name"
              className={GSCH_FIELD}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="gsch-city-country" className="mb-1 block text-sm font-medium text-content">
              Country
            </label>
            <input
              id="gsch-city-country"
              className={GSCH_FIELD}
              value={form.country}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="gsch-city-continent" className="mb-1 block text-sm font-medium text-content">
              Continent
            </label>
            <select
              id="gsch-city-continent"
              className={GSCH_FIELD}
              value={form.continent}
              onChange={(e) => setForm((f) => ({ ...f, continent: e.target.value }))}
            >
              <option value="">Select…</option>
              {GSCH_CONTINENTS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="gsch-city-state" className="mb-1 block text-sm font-medium text-content">
              State / province
            </label>
            <input
              id="gsch-city-state"
              className={GSCH_FIELD}
              value={form.state_province}
              onChange={(e) => setForm((f) => ({ ...f, state_province: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="gsch-city-pop" className="mb-1 block text-sm font-medium text-content">
              Population
            </label>
            <input
              id="gsch-city-pop"
              type="number"
              className={GSCH_FIELD}
              value={form.population}
              onChange={(e) => setForm((f) => ({ ...f, population: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="gsch-city-web" className="mb-1 block text-sm font-medium text-content">
              Official website
            </label>
            <input
              id="gsch-city-web"
              className={GSCH_FIELD}
              value={form.official_website}
              onChange={(e) => setForm((f) => ({ ...f, official_website: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="gsch-city-desc" className="mb-1 block text-sm font-medium text-content">
              Description
            </label>
            <textarea
              id="gsch-city-desc"
              className={`${GSCH_FIELD} min-h-[88px]`}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="gsch-city-mayor" className="mb-1 block text-sm font-medium text-content">
              Mayor / leader name
            </label>
            <input
              id="gsch-city-mayor"
              className={GSCH_FIELD}
              value={form.mayor_name}
              onChange={(e) => setForm((f) => ({ ...f, mayor_name: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="gsch-city-industries" className="mb-1 block text-sm font-medium text-content">
              Major industries
            </label>
            <input
              id="gsch-city-industries"
              className={GSCH_FIELD}
              value={form.major_industries}
              onChange={(e) => setForm((f) => ({ ...f, major_industries: e.target.value }))}
              placeholder="tech, tourism, agriculture"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="gsch-city-collab" className="mb-1 block text-sm font-medium text-content">
              Collaboration interests
            </label>
            <input
              id="gsch-city-collab"
              className={GSCH_FIELD}
              value={form.collaboration_interests}
              onChange={(e) =>
                setForm((f) => ({ ...f, collaboration_interests: e.target.value }))
              }
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-content sm:col-span-2">
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={(e) => setForm((f) => ({ ...f, is_published: e.target.checked }))}
            />
            Publish city profile
          </label>
        </div>
      </GschFormModal>

      {cities.length === 0 ? (
        <EmptyState
          title="No city profiles yet"
          description="Create a profile for a city or community you represent."
          action={
            <button type="button" className="btn-primary" onClick={openCreate}>
              Create city profile
            </button>
          }
        />
      ) : (
        <>
          <GschSectionHeader
            title="City profiles"
            badge={<span className={GSCH_COUNT_BADGE}>{cities.length}</span>}
          />
          {view === 'map' ? (
            <GschWorldMap cities={cities} autoLoadConnections />
          ) : (
            <GschDataTable>
              <GschTableHead>
                <GschTableHeadCell>City</GschTableHeadCell>
                <GschTableHeadCell>Country</GschTableHeadCell>
                <GschTableHeadCell>Status</GschTableHeadCell>
                <GschTableHeadCell align="right">Actions</GschTableHeadCell>
              </GschTableHead>
              <GschTableBody>
                {cities.map((city) => (
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
                    <GschTableCell>
                      <StatusBadge status={city.is_published ? 'published' : 'draft'} />
                    </GschTableCell>
                    <GschTableCell align="right">
                      <GschRowActions
                        onView={() => router.push(`/global-hub/cities/${city.id}`)}
                        onPublish={() => togglePublish(city)}
                        publishLabel={city.is_published ? 'Unpublish' : 'Publish'}
                        publishing={publishingId === city.id}
                        onEdit={() => openEdit(city)}
                        onDelete={() => handleDelete(city)}
                        deleting={deletingId === city.id}
                      />
                    </GschTableCell>
                  </GschTableRow>
                ))}
              </GschTableBody>
            </GschDataTable>
          )}
        </>
      )}
    </div>
  )
}
