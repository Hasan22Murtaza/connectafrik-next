'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import { useConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { MoreHorizontal, Pencil, Trash2 } from '@/shared/icons'
import YouthShell from '@/features/youth-leadership/components/YouthShell'
import StatusBadge from '@/features/youth-leadership/components/StatusBadge'
import EmptyState from '@/features/youth-leadership/components/EmptyState'
import YouthFormModal, {
  YOUTH_FIELD,
  YouthFieldLabel,
} from '@/features/youth-leadership/components/YouthFormModal'
import VerifiedBadge from '@/features/youth-leadership/components/VerifiedBadge'
import YouthSkeleton from '@/features/youth-leadership/components/YouthSkeleton'
import YouthSectionHeader from '@/features/youth-leadership/components/YouthSectionHeader'
import { YOUTH_CARD } from '@/features/youth-leadership/constants/nav'
import type { YouthOrganization } from '@/shared/types/youthLeadership'

type OrgRow = YouthOrganization & { my_role?: string | null }

const EMPTY_ORG_FORM = {
  name: '',
  description: '',
  country: '',
  region: '',
  website: '',
}

export default function YouthOrganizationListPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { confirm, dialog: confirmDialog } = useConfirmDialog()
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [showOrgModal, setShowOrgModal] = useState(false)
  const [editingOrg, setEditingOrg] = useState<OrgRow | null>(null)
  const [orgForm, setOrgForm] = useState(EMPTY_ORG_FORM)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const loadOrgs = useCallback(async () => {
    const data = await apiClient.get<OrgRow[]>('/api/youth-leadership/organizations')
    setOrgs(Array.isArray(data) ? data : [])
  }, [])

  useEffect(() => {
    if (authLoading || !user) return
    ;(async () => {
      setLoading(true)
      try {
        await loadOrgs()
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Failed to load organizations')
      } finally {
        setLoading(false)
      }
    })()
  }, [authLoading, user?.id, loadOrgs])

  useEffect(() => {
    if (!menuOpenId) return

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpenId(null)
      }
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpenId(null)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [menuOpenId])

  function openCreateModal() {
    setEditingOrg(null)
    setOrgForm(EMPTY_ORG_FORM)
    setShowOrgModal(true)
  }

  function openEditModal(org: OrgRow) {
    setMenuOpenId(null)
    setEditingOrg(org)
    setOrgForm({
      name: org.name || '',
      description: org.description || '',
      country: org.country || '',
      region: org.region || '',
      website: org.website || '',
    })
    setShowOrgModal(true)
  }

  async function saveOrg() {
    if (!orgForm.name.trim()) {
      toast.error('Organization name is required')
      return
    }
    setBusy(true)
    try {
      if (editingOrg) {
        await apiClient.patch<OrgRow>(
          `/api/youth-leadership/organizations/${editingOrg.id}`,
          orgForm
        )
        toast.success('Organization updated')
        setOrgForm(EMPTY_ORG_FORM)
        setEditingOrg(null)
        setShowOrgModal(false)
        await loadOrgs()
      } else {
        const org = await apiClient.post<OrgRow>('/api/youth-leadership/organizations', orgForm)
        toast.success('Organization created')
        setOrgForm(EMPTY_ORG_FORM)
        setShowOrgModal(false)
        router.push(`/youth-leadership/organization/${org.id}`)
      }
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : editingOrg
            ? 'Failed to update organization'
            : 'Failed to create organization'
      )
    } finally {
      setBusy(false)
    }
  }

  async function deleteOrg(org: OrgRow) {
    setMenuOpenId(null)
    const ok = await confirm({
      title: 'Delete organization?',
      message: `“${org.name}” and its related programs data will be permanently removed. This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (!ok) return

    setBusy(true)
    try {
      await apiClient.delete(`/api/youth-leadership/organizations/${org.id}`)
      toast.success('Organization deleted')
      setOrgs((prev) => prev.filter((item) => item.id !== org.id))
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete organization')
    } finally {
      setBusy(false)
    }
  }

  function closeOrgModal() {
    if (busy) return
    setShowOrgModal(false)
    setEditingOrg(null)
  }

  if (authLoading || loading) {
    return (
      <YouthShell
        title="Organization"
        subtitle="Create an organization, publish programs, and review applications."
      >
        <YouthSkeleton count={4} variant="table" />
      </YouthShell>
    )
  }

  if (!user) {
    return (
      <YouthShell
        title="Organization"
        subtitle="Create an organization, publish programs, and review applications."
      >
        <EmptyState title="Sign in required" />
      </YouthShell>
    )
  }

  return (
    <YouthShell
      title="Organization"
      subtitle="Create an organization, publish programs, and review applications."
      actions={
        orgs.length > 0 ? (
          <button type="button" className="btn-primary text-sm" onClick={openCreateModal}>
            New organization
          </button>
        ) : null
      }
    >
      {orgs.length === 0 ? (
        <EmptyState
          title="No organization yet"
          description="Create an organization to publish programs and review applications."
          action={
            <button type="button" className="btn-primary" onClick={openCreateModal}>
              Create organization
            </button>
          }
        />
      ) : (
        <section>
          <YouthSectionHeader
            title="Your organizations"
            badge={
              <span className="rounded-full bg-surface-secondary px-2.5 py-0.5 text-xs font-medium text-content-secondary">
                {orgs.length} total
              </span>
            }
          />
          <div className={`${YOUTH_CARD} overflow-visible p-0`}>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-secondary/50">
                  <th className="px-5 py-3.5 text-sm font-semibold text-content">Organization</th>
                  <th className="w-36 px-5 py-3.5 text-sm font-semibold text-content">Status</th>
                  <th className="w-20 px-5 py-3.5 text-right text-sm font-semibold text-content">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => {
                  const canManage = org.my_role === 'admin'
                  const isMenuOpen = menuOpenId === org.id
                  return (
                    <tr
                      key={org.id}
                      className="border-b border-border/70 last:border-b-0 hover:bg-surface-secondary/40"
                    >
                      <td className="px-5 py-4 align-middle">
                        <Link
                          href={`/youth-leadership/organization/${org.id}`}
                          className="block truncate text-[0.98rem] font-semibold leading-snug tracking-tight text-content hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                        >
                          {org.name}
                        </Link>
                      </td>
                      <td className="px-5 py-4 align-middle">
                        {org.verification_status === 'verified' ? (
                          <VerifiedBadge label="Verified" />
                        ) : (
                          <StatusBadge status={org.verification_status} />
                        )}
                      </td>
                      <td
                        className={`px-5 py-4 align-middle text-right ${isMenuOpen ? 'relative z-20' : ''}`}
                      >
                        {canManage ? (
                          <div
                            className="relative inline-flex justify-end"
                            ref={isMenuOpen ? menuRef : undefined}
                          >
                            <button
                              type="button"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-content-secondary transition hover:bg-surface-secondary hover:text-content disabled:opacity-50"
                              aria-label={`Actions for ${org.name}`}
                              aria-expanded={isMenuOpen}
                              aria-haspopup="menu"
                              disabled={busy}
                              onClick={() =>
                                setMenuOpenId((current) => (current === org.id ? null : org.id))
                              }
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                            {isMenuOpen ? (
                              <div
                                role="menu"
                                className="absolute right-0 top-full z-30 mt-1 w-40 rounded-lg border border-border bg-surface py-1 shadow-lg"
                              >
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-content transition hover:bg-surface-hover"
                                  onClick={() => openEditModal(org)}
                                >
                                  <Pencil className="h-4 w-4 shrink-0" />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-50"
                                  onClick={() => deleteOrg(org)}
                                >
                                  <Trash2 className="h-4 w-4 shrink-0" />
                                  Delete
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-content-tertiary">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <YouthFormModal
        open={showOrgModal}
        title={editingOrg ? 'Edit organization' : 'Create organization'}
     
        onClose={closeOrgModal}
        size="md"
        footer={
          <>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={closeOrgModal}
            >
              Cancel
            </button>
            <button type="button" className="btn-primary" disabled={busy} onClick={saveOrg}>
              {busy
                ? editingOrg
                  ? 'Saving…'
                  : 'Creating…'
                : editingOrg
                  ? 'Save changes'
                  : 'Create organization'}
            </button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <YouthFieldLabel htmlFor="org-name">Name</YouthFieldLabel>
            <input
              id="org-name"
              className={YOUTH_FIELD}
              value={orgForm.name}
              onChange={(e) => setOrgForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <YouthFieldLabel htmlFor="org-description">Description</YouthFieldLabel>
            <textarea
              id="org-description"
              className={`${YOUTH_FIELD} min-h-[88px]`}
              value={orgForm.description}
              onChange={(e) => setOrgForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div>
            <YouthFieldLabel htmlFor="org-country">Country</YouthFieldLabel>
            <input
              id="org-country"
              className={YOUTH_FIELD}
              value={orgForm.country}
              onChange={(e) => setOrgForm((f) => ({ ...f, country: e.target.value }))}
            />
          </div>
          <div>
            <YouthFieldLabel htmlFor="org-region">Region</YouthFieldLabel>
            <input
              id="org-region"
              className={YOUTH_FIELD}
              value={orgForm.region}
              onChange={(e) => setOrgForm((f) => ({ ...f, region: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <YouthFieldLabel htmlFor="org-website">Website</YouthFieldLabel>
            <input
              id="org-website"
              className={YOUTH_FIELD}
              value={orgForm.website}
              onChange={(e) => setOrgForm((f) => ({ ...f, website: e.target.value }))}
            />
          </div>
        </div>
      </YouthFormModal>
      {confirmDialog}
    </YouthShell>
  )
}
