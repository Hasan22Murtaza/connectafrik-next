'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import EmptyState from '@/features/gsch/components/EmptyState'
import StatusBadge from '@/features/gsch/components/StatusBadge'
import { GSCH_CARD, GSCH_FIELD } from '@/features/gsch/constants/styles'
import {
  GSCH_ORG_TYPES,
  type GschOrganization,
  type GschOrgType,
} from '@/shared/types/gsch'

const EMPTY_FORM: {
  name: string
  org_type: GschOrgType
  country: string
  state_province: string
  city: string
  website: string
  official_email: string
  description: string
  areas_of_interest: string
} = {
  name: '',
  org_type: 'municipality',
  country: '',
  state_province: '',
  city: '',
  website: '',
  official_email: '',
  description: '',
  areas_of_interest: '',
}

export default function OrganizationPanel() {
  const { user, loading: authLoading } = useAuth()
  const [orgs, setOrgs] = useState<GschOrganization[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  const load = useCallback(async () => {
    const data = await apiClient.get<GschOrganization[]>('/api/gsch/organizations')
    setOrgs(Array.isArray(data) ? data : [])
  }, [])

  useEffect(() => {
    if (authLoading || !user) return
    ;(async () => {
      setLoading(true)
      try {
        await load()
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Failed to load organizations')
      } finally {
        setLoading(false)
      }
    })()
  }, [authLoading, user?.id, load])

  async function createOrg() {
    if (!form.name.trim() || !form.country.trim()) {
      toast.error('Name and country are required')
      return
    }
    setBusy(true)
    try {
      await apiClient.post('/api/gsch/organizations', {
        ...form,
        areas_of_interest: form.areas_of_interest
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      })
      toast.success('Organization created as draft — verification required')
      setForm(EMPTY_FORM)
      setShowForm(false)
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create organization')
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
          Organizations start as drafts. Municipalities and all other types require human
          verification before badges are assigned.
        </p>
        <button
          type="button"
          className="btn-primary text-sm"
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? 'Cancel' : 'New organization'}
        </button>
      </div>

      {showForm ? (
        <div className={`${GSCH_CARD} space-y-3`}>
          <h3 className="font-semibold text-content">Create organization</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="gsch-org-name" className="mb-1 block text-sm font-medium text-content">
                Name
              </label>
              <input
                id="gsch-org-name"
                className={GSCH_FIELD}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div>
              <label htmlFor="gsch-org-type" className="mb-1 block text-sm font-medium text-content">
                Organization type
              </label>
              <select
                id="gsch-org-type"
                className={GSCH_FIELD}
                value={form.org_type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, org_type: e.target.value as GschOrgType }))
                }
              >
                {GSCH_ORG_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="gsch-org-country" className="mb-1 block text-sm font-medium text-content">
                Country
              </label>
              <input
                id="gsch-org-country"
                className={GSCH_FIELD}
                value={form.country}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                required
              />
            </div>
            <div>
              <label htmlFor="gsch-org-state" className="mb-1 block text-sm font-medium text-content">
                State / province
              </label>
              <input
                id="gsch-org-state"
                className={GSCH_FIELD}
                value={form.state_province}
                onChange={(e) => setForm((f) => ({ ...f, state_province: e.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="gsch-org-city" className="mb-1 block text-sm font-medium text-content">
                City
              </label>
              <input
                id="gsch-org-city"
                className={GSCH_FIELD}
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="gsch-org-website" className="mb-1 block text-sm font-medium text-content">
                Website
              </label>
              <input
                id="gsch-org-website"
                className={GSCH_FIELD}
                value={form.website}
                onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="gsch-org-email" className="mb-1 block text-sm font-medium text-content">
                Official email
              </label>
              <input
                id="gsch-org-email"
                type="email"
                className={GSCH_FIELD}
                value={form.official_email}
                onChange={(e) => setForm((f) => ({ ...f, official_email: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="gsch-org-desc" className="mb-1 block text-sm font-medium text-content">
                Description
              </label>
              <textarea
                id="gsch-org-desc"
                className={`${GSCH_FIELD} min-h-[88px]`}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="gsch-org-interests" className="mb-1 block text-sm font-medium text-content">
                Areas of interest (comma-separated)
              </label>
              <input
                id="gsch-org-interests"
                className={GSCH_FIELD}
                value={form.areas_of_interest}
                onChange={(e) => setForm((f) => ({ ...f, areas_of_interest: e.target.value }))}
                placeholder="education, tourism, climate"
              />
            </div>
          </div>
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={busy}
            onClick={createOrg}
          >
            {busy ? 'Creating…' : 'Create organization'}
          </button>
        </div>
      ) : null}

      {orgs.length === 0 ? (
        <EmptyState
          title="No organizations yet"
          description="Create an organization to begin verification and city profile management."
          action={
            <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
              Create organization
            </button>
          }
        />
      ) : (
        <div className={`${GSCH_CARD} overflow-hidden p-0`}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-secondary/50">
                <th className="px-5 py-3.5 font-semibold text-content">Organization</th>
                <th className="px-5 py-3.5 font-semibold text-content">Type</th>
                <th className="px-5 py-3.5 font-semibold text-content">Status</th>
                <th className="px-5 py-3.5 text-right font-semibold text-content">Role</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((org) => (
                <tr key={org.id} className="border-b border-border/70 last:border-b-0">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-content">{org.name}</p>
                    <p className="text-xs text-content-tertiary">
                      {[org.city, org.country].filter(Boolean).join(', ')}
                    </p>
                  </td>
                  <td className="px-5 py-4 capitalize text-content-secondary">
                    {org.org_type.replace(/_/g, ' ')}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={org.verification_status} />
                  </td>
                  <td className="px-5 py-4 text-right capitalize text-content-secondary">
                    {org.my_role || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-sm text-content-secondary">
        Ready to verify?{' '}
        <Link href="/global-hub/verification" className="font-medium text-primary">
          Submit verification
        </Link>
      </p>
    </div>
  )
}
