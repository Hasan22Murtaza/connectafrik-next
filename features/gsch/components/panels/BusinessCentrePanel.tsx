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
import TradeEnquiriesPanel from '@/features/gsch/components/panels/TradeEnquiriesPanel'
import { useConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import {
  GSCH_CARD,
  GSCH_FIELD,
  GSCH_LABEL,
  GSCH_SELECT,
} from '@/features/gsch/constants/styles'
import {
  GSCH_BUSINESS_OFFERING_OPTIONS,
  GSCH_BUSINESS_SEEKING_OPTIONS,
  type GschBusinessProfile,
  type GschOrganization,
  type GschPaginated,
} from '@/shared/types/gsch'

type Tab = 'discover' | 'profile' | 'enquiries'

const EMPTY_FORM = {
  organization_id: '',
  display_name: '',
  tagline: '',
  description: '',
  website: '',
  country: '',
  city: '',
  industry_sectors: '',
  seeking: [] as string[],
  offering: [] as string[],
  export_markets: '',
  import_needs: '',
  languages: '',
  employee_range: '',
  year_established: '',
  is_published: false,
}

function toggleInList(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

function formatTags(tags: string[] | null | undefined) {
  if (!tags?.length) return '—'
  return tags.slice(0, 3).map((t) => t.replace(/_/g, ' ')).join(', ')
}

export default function BusinessCentrePanel() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { confirm, dialog } = useConfirmDialog()
  const [tab, setTab] = useState<Tab>('discover')
  const [profiles, setProfiles] = useState<GschBusinessProfile[]>([])
  const [myProfiles, setMyProfiles] = useState<GschBusinessProfile[]>([])
  const [orgs, setOrgs] = useState<GschOrganization[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState({
    q: '',
    country: '',
    seeking: '',
    offering: '',
  })
  const [applied, setApplied] = useState(filters)
  const [form, setForm] = useState(EMPTY_FORM)

  const activeFilterCount = countActiveFilters(applied)

  const loadOrgs = useCallback(async () => {
    try {
      const orgRes = await apiClient.get<GschOrganization[]>(
        '/api/gsch/organizations?mine=1'
      )
      setOrgs(orgRes || [])
    } catch {
      /* optional for form */
    }
  }, [])

  const loadDiscover = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('limit', '30')
      if (applied.q) params.set('q', applied.q)
      if (applied.country) params.set('country', applied.country)
      if (applied.seeking) params.set('seeking', applied.seeking)
      if (applied.offering) params.set('offering', applied.offering)
      const data = await apiClient.get<GschPaginated<GschBusinessProfile>>(
        `/api/gsch/business-profiles?${params.toString()}`
      )
      setProfiles(data.data || [])
    } catch (err) {
      setProfiles([])
      toast.error(err instanceof ApiError ? err.message : 'Failed to load profiles')
    } finally {
      setLoading(false)
    }
  }, [applied])

  const loadMyProfile = useCallback(async () => {
    setLoading(true)
    try {
      const [orgRes, mineRes] = await Promise.all([
        apiClient.get<GschOrganization[]>('/api/gsch/organizations?mine=1'),
        apiClient.get<GschPaginated<GschBusinessProfile>>(
          '/api/gsch/business-profiles?mine=1&limit=20'
        ),
      ])
      setOrgs(orgRes || [])
      setMyProfiles(mineRes.data || [])
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading || !user) return
    loadOrgs()
    if (tab === 'discover') loadDiscover()
    else if (tab === 'profile') loadMyProfile()
  }, [authLoading, user?.id, tab, loadDiscover, loadMyProfile, loadOrgs])

  function profileToForm(profile: GschBusinessProfile) {
    return {
      organization_id: profile.organization_id || orgs[0]?.id || '',
      display_name: profile.display_name || '',
      tagline: profile.tagline || '',
      description: profile.description || '',
      website: profile.website || '',
      country: profile.country || '',
      city: profile.city || '',
      industry_sectors: (profile.industry_sectors || []).join(', '),
      seeking: profile.seeking || [],
      offering: profile.offering || [],
      export_markets: (profile.export_markets || []).join(', '),
      import_needs: (profile.import_needs || []).join(', '),
      languages: (profile.languages || []).join(', '),
      employee_range: profile.employee_range || '',
      year_established: profile.year_established
        ? String(profile.year_established)
        : '',
      is_published: profile.is_published || false,
    }
  }

  function openCreate() {
    setEditingId(null)
    setForm({
      ...EMPTY_FORM,
      organization_id: orgs[0]?.id || '',
      display_name: orgs[0]?.name || '',
      country: orgs[0]?.country || '',
      city: orgs[0]?.city || '',
    })
    setShowForm(true)
  }

  function openEdit(profile: GschBusinessProfile) {
    setEditingId(profile.id)
    setForm(profileToForm(profile))
    setShowForm(true)
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!form.organization_id || !form.display_name.trim()) {
      toast.error('Organization and display name are required')
      return
    }
    setSubmitting(true)
    const payload = {
      ...form,
      year_established: form.year_established || null,
    }
    try {
      if (editingId) {
        await apiClient.patch(`/api/gsch/business-profiles/${editingId}`, payload)
        toast.success('Business profile updated')
      } else {
        await apiClient.post('/api/gsch/business-profiles', payload)
        toast.success('Business profile saved')
      }
      setShowForm(false)
      setEditingId(null)
      if (tab === 'discover') await loadDiscover()
      else await loadMyProfile()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(profile: GschBusinessProfile) {
    const ok = await confirm({
      title: 'Delete business profile?',
      message: `Delete “${profile.display_name}”? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (!ok) return
    setDeletingId(profile.id)
    try {
      await apiClient.delete(`/api/gsch/business-profiles/${profile.id}`)
      toast.success('Business profile deleted')
      if (tab === 'discover') await loadDiscover()
      else await loadMyProfile()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  async function togglePublish(profile: GschBusinessProfile) {
    setPublishingId(profile.id)
    try {
      const updated = await apiClient.patch<GschBusinessProfile>(
        `/api/gsch/business-profiles/${profile.id}`,
        { is_published: !profile.is_published }
      )
      toast.success(updated.is_published ? 'Published' : 'Unpublished')
      if (tab === 'discover') await loadDiscover()
      else await loadMyProfile()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Update failed')
    } finally {
      setPublishingId(null)
    }
  }

  function canEnquire(profile: GschBusinessProfile) {
    return (
      profile.is_published &&
      orgs.length > 0 &&
      !orgs.some((o) => o.id === profile.organization_id)
    )
  }

  function applyFilters() {
    setApplied(filters)
    setFiltersOpen(false)
  }

  function resetFilters() {
    const empty = { q: '', country: '', seeking: '', offering: '' }
    setFilters(empty)
    setApplied(empty)
    setFiltersOpen(false)
  }

  function renderProfileTable(items: GschBusinessProfile[]) {
    return (
      <GschDataTable>
        <GschTableHead>
          <GschTableHeadCell>Name / Org</GschTableHeadCell>
          <GschTableHeadCell>Country</GschTableHeadCell>
          <GschTableHeadCell>Seeking</GschTableHeadCell>
          <GschTableHeadCell>Offering</GschTableHeadCell>
          <GschTableHeadCell>Status</GschTableHeadCell>
          <GschTableHeadCell align="right">Actions</GschTableHeadCell>
        </GschTableHead>
        <GschTableBody>
          {items.map((item) => (
            <GschTableRow
              key={item.id}
              onClick={() => router.push(`/global-hub/business/${item.id}`)}
            >
              <GschTableCell className="min-w-[160px]">
                <p className="font-semibold text-content">{item.display_name}</p>
                <p className="mt-0.5 text-xs text-content-tertiary">
                  {item.organization?.name || '—'}
                </p>
              </GschTableCell>
              <GschTableCell>{item.country || '—'}</GschTableCell>
              <GschTableCell className="capitalize">{formatTags(item.seeking)}</GschTableCell>
              <GschTableCell className="capitalize">{formatTags(item.offering)}</GschTableCell>
              <GschTableCell>
                <StatusBadge status={item.is_published ? 'published' : 'draft'} />
              </GschTableCell>
              <GschTableCell align="right">
                <GschRowActions
                  onView={() => router.push(`/global-hub/business/${item.id}`)}
                  onPublish={() => togglePublish(item)}
                  publishLabel={item.is_published ? 'Unpublish' : 'Publish'}
                  publishing={publishingId === item.id}
                  onEnquire={
                    canEnquire(item)
                      ? () =>
                          router.push(
                            `/global-hub/business/${item.id}?enquire=1`
                          )
                      : undefined
                  }
                  onEdit={() => openEdit(item)}
                  onDelete={() => handleDelete(item)}
                  deleting={deletingId === item.id}
                />
              </GschTableCell>
            </GschTableRow>
          ))}
        </GschTableBody>
      </GschDataTable>
    )
  }

  if (authLoading) {
    return <div className={`${GSCH_CARD} h-40 animate-pulse`} />
  }
  if (!user) return <EmptyState title="Sign in required" />

  return (
    <div className="space-y-6">
      {dialog}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['discover', 'Discover'],
            ['profile', 'My profile'],
            ['enquiries', 'Enquiries'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={tab === key ? 'btn-primary text-sm' : 'btn-secondary text-sm'}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'discover' ? (
        <>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <GschFiltersButton
              activeCount={activeFilterCount}
              onClick={() => setFiltersOpen(true)}
            />
          </div>

          <GschFilterDrawer
            open={filtersOpen}
            title="Filter business profiles"
            description="Narrow discover results by location and trade intent."
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
              <label className={GSCH_LABEL} htmlFor="gsch-biz-q">
                Search
              </label>
              <input
                id="gsch-biz-q"
                className={GSCH_FIELD}
                placeholder="Search…"
                value={filters.q}
                onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              />
            </div>
            <div>
              <label className={GSCH_LABEL} htmlFor="gsch-biz-country">
                Country
              </label>
              <input
                id="gsch-biz-country"
                className={GSCH_FIELD}
                placeholder="Country"
                value={filters.country}
                onChange={(e) => setFilters((f) => ({ ...f, country: e.target.value }))}
              />
            </div>
            <div>
              <label className={GSCH_LABEL} htmlFor="gsch-biz-seeking">
                Seeking
              </label>
              <select
                id="gsch-biz-seeking"
                className={`${GSCH_SELECT} w-full`}
                value={filters.seeking}
                onChange={(e) => setFilters((f) => ({ ...f, seeking: e.target.value }))}
              >
                <option value="">Seeking (any)</option>
                {GSCH_BUSINESS_SEEKING_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={GSCH_LABEL} htmlFor="gsch-biz-offering">
                Offering
              </label>
              <select
                id="gsch-biz-offering"
                className={`${GSCH_SELECT} w-full`}
                value={filters.offering}
                onChange={(e) => setFilters((f) => ({ ...f, offering: e.target.value }))}
              >
                <option value="">Offering (any)</option>
                {GSCH_BUSINESS_OFFERING_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </GschFilterDrawer>

          {loading ? (
            <div className={`${GSCH_CARD} h-40 animate-pulse`} />
          ) : profiles.length === 0 ? (
            <EmptyState
              title="No business profiles yet"
              description="Create and publish your org’s business profile to appear here."
            />
          ) : (
            renderProfileTable(profiles)
          )}
        </>
      ) : null}

      {tab === 'profile' ? (
        loading ? (
          <div className={`${GSCH_CARD} h-40 animate-pulse`} />
        ) : orgs.length === 0 ? (
          <EmptyState
            title="Create an organization first"
            description="Business profiles are linked one-to-one with a GSCH organization."
          />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button type="button" className="btn-primary text-sm" onClick={openCreate}>
                {myProfiles.length > 0 ? 'New profile' : 'Create business profile'}
              </button>
            </div>
            {myProfiles.length === 0 ? (
              <EmptyState
                title="No business profile yet"
                description="Create and publish your org’s business profile to appear in Discover."
                action={
                  <button type="button" className="btn-primary text-sm" onClick={openCreate}>
                    Create business profile
                  </button>
                }
              />
            ) : (
              renderProfileTable(myProfiles)
            )}
          </div>
        )
      ) : null}

            <GschFormModal
        open={showForm}
        title={editingId ? 'Edit business profile' : 'Create business profile'}
        onClose={() => {
          setShowForm(false)
          setEditingId(null)
        }}
        footer={
          <>
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={submitting}
              onClick={() => {
                setShowForm(false)
                setEditingId(null)
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="gsch-business-profile-form"
              className="btn-primary text-sm"
              disabled={submitting}
            >
              {submitting ? 'Saving…' : editingId ? 'Save changes' : 'Save profile'}
            </button>
          </>
        }
      >
        <form id="gsch-business-profile-form" onSubmit={saveProfile} className="space-y-3">
          <select
            className={`${GSCH_SELECT} w-full`}
            value={form.organization_id}
            onChange={(e) => {
              const org = orgs.find((o) => o.id === e.target.value)
              const existing = myProfiles.find((p) => p.organization_id === e.target.value)
              setForm((f) => ({
                ...f,
                organization_id: e.target.value,
                display_name: existing?.display_name || org?.name || f.display_name,
                country: existing?.country || org?.country || f.country,
                city: existing?.city || org?.city || f.city,
              }))
            }}
            required
            disabled={Boolean(editingId)}
          >
            {(
              orgs.some((o) => o.id === form.organization_id) || !form.organization_id
                ? orgs
                : [
                    {
                      id: form.organization_id,
                      name:
                        profiles.find((p) => p.organization_id === form.organization_id)
                          ?.organization?.name ||
                        myProfiles.find((p) => p.organization_id === form.organization_id)
                          ?.organization?.name ||
                        'Current organization',
                    } as GschOrganization,
                    ...orgs,
                  ]
            ).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
                {myProfiles.some((p) => p.organization_id === o.id) ? ' (has profile)' : ''}
              </option>
            ))}
          </select>
          <input
            className={GSCH_FIELD}
            placeholder="Display name"
            value={form.display_name}
            onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
            required
          />
          <input
            className={GSCH_FIELD}
            placeholder="Tagline"
            value={form.tagline}
            onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
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
            <input
              className={GSCH_FIELD}
              placeholder="City"
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            />
            <input
              className={GSCH_FIELD}
              placeholder="Website"
              value={form.website}
              onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
            />
          </div>
          <input
            className={GSCH_FIELD}
            placeholder="Industry sectors (comma-separated)"
            value={form.industry_sectors}
            onChange={(e) => setForm((f) => ({ ...f, industry_sectors: e.target.value }))}
          />
          <div>
            <p className="mb-2 text-sm font-medium text-content">Seeking</p>
            <div className="flex flex-wrap gap-2">
              {GSCH_BUSINESS_SEEKING_OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className="flex items-center gap-1.5 text-sm text-content-secondary"
                >
                  <input
                    type="checkbox"
                    checked={form.seeking.includes(o.value)}
                    onChange={() =>
                      setForm((f) => ({
                        ...f,
                        seeking: toggleInList(f.seeking, o.value),
                      }))
                    }
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-content">Offering</p>
            <div className="flex flex-wrap gap-2">
              {GSCH_BUSINESS_OFFERING_OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className="flex items-center gap-1.5 text-sm text-content-secondary"
                >
                  <input
                    type="checkbox"
                    checked={form.offering.includes(o.value)}
                    onChange={() =>
                      setForm((f) => ({
                        ...f,
                        offering: toggleInList(f.offering, o.value),
                      }))
                    }
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              className={GSCH_FIELD}
              placeholder="Export markets (comma-separated)"
              value={form.export_markets}
              onChange={(e) => setForm((f) => ({ ...f, export_markets: e.target.value }))}
            />
            <input
              className={GSCH_FIELD}
              placeholder="Import needs (comma-separated)"
              value={form.import_needs}
              onChange={(e) => setForm((f) => ({ ...f, import_needs: e.target.value }))}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              className={GSCH_FIELD}
              placeholder="Languages"
              value={form.languages}
              onChange={(e) => setForm((f) => ({ ...f, languages: e.target.value }))}
            />
            <input
              className={GSCH_FIELD}
              placeholder="Employee range"
              value={form.employee_range}
              onChange={(e) => setForm((f) => ({ ...f, employee_range: e.target.value }))}
            />
            <input
              className={GSCH_FIELD}
              type="number"
              placeholder="Year established"
              value={form.year_established}
              onChange={(e) => setForm((f) => ({ ...f, year_established: e.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-content-secondary">
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={(e) => setForm((f) => ({ ...f, is_published: e.target.checked }))}
            />
            Publish profile
          </label>
        </form>
      </GschFormModal>

      {tab === 'enquiries' ? <TradeEnquiriesPanel /> : null}
    </div>
  )
}
