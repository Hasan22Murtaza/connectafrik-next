'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import EmptyState from '@/features/gsch/components/EmptyState'
import StatusBadge from '@/features/gsch/components/StatusBadge'
import { GSCH_CARD, GSCH_FIELD } from '@/features/gsch/constants/styles'
import { GSCH_CONTINENTS, type GschCity, type GschOrganization, type GschPaginated } from '@/shared/types/gsch'

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
  const { user, loading: authLoading } = useAuth()
  const [cities, setCities] = useState<GschCity[]>([])
  const [orgs, setOrgs] = useState<GschOrganization[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const load = useCallback(async () => {
    const [cityPayload, orgData] = await Promise.all([
      apiClient.get<GschPaginated<GschCity>>('/api/gsch/cities', { mine: '1', limit: 50 }),
      apiClient.get<GschOrganization[]>('/api/gsch/organizations'),
    ])
    setCities(cityPayload?.data || [])
    const orgList = Array.isArray(orgData) ? orgData : []
    setOrgs(orgList)
    if (!form.organization_id && orgList[0]?.id) {
      setForm((f) => ({ ...f, organization_id: orgList[0].id }))
    }
  }, [form.organization_id])

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id])

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

  if (authLoading || loading) {
    return <div className={`${GSCH_CARD} h-40 animate-pulse`} />
  }

  if (!user) return <EmptyState title="Sign in required" />

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-content-secondary">
          Create and publish city profiles linked to your organizations.
        </p>
        <button type="button" className="btn-primary text-sm" onClick={openCreate}>
          New city profile
        </button>
      </div>

      {showForm ? (
        <div className={`${GSCH_CARD} space-y-3`}>
          <h3 className="font-semibold text-content">
            {editingId ? 'Edit city profile' : 'Create city profile'}
          </h3>
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
          <div className="flex gap-2">
            <button type="button" className="btn-secondary text-sm" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button type="button" className="btn-primary text-sm" disabled={busy} onClick={save}>
              {busy ? 'Saving…' : editingId ? 'Save changes' : 'Create city'}
            </button>
          </div>
        </div>
      ) : null}

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
              </div>
              <StatusBadge status={city.is_published ? 'published' : 'draft'} />
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => openEdit(city)}
              >
                Edit
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
