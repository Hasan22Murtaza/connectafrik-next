'use client'

import { useState } from 'react'
import { Globe } from '@/shared/icons'
import { AdminLoading } from '@/features/admin/components/AdminLoading'
import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader'
import { useAdminAuth } from '@/features/admin/hooks/useAdminAuth'
import AdminOrgTiersPanel from '@/features/gsch/components/panels/AdminOrgTiersPanel'
import AdminVerificationsPanel from '@/features/gsch/components/panels/AdminVerificationsPanel'
import ProjectModerationPanel from '@/features/gsch/components/panels/ProjectModerationPanel'

type GschAdminTab = 'orgs' | 'projects' | 'tiers'

const TABS: { id: GschAdminTab; label: string }[] = [
  { id: 'orgs', label: 'Organizations' },
  { id: 'projects', label: 'Projects' },
  { id: 'tiers', label: 'Tiers' },
]

export default function AdminGlobalHubPage() {
  const { isReady, authLoading } = useAdminAuth('/admin/global-hub')
  const [tab, setTab] = useState<GschAdminTab>('orgs')

  if (authLoading || !isReady) {
    return <AdminLoading />
  }

  return (
    <>
      <AdminPageHeader
        title="Global Hub"
        description="Review verification requests, investment listings, and organization tiers."
        icon={Globe}
      />

      <div
        className="mb-5 inline-flex max-w-full flex-wrap rounded-xl border border-gray-200 bg-white p-1 shadow-sm"
        role="tablist"
        aria-label="Global Hub admin sections"
      >
        {TABS.map(({ id, label }) => {
          const active = tab === id
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition ${
                active
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {tab === 'orgs' ? (
        <AdminVerificationsPanel />
      ) : tab === 'projects' ? (
        <ProjectModerationPanel />
      ) : (
        <AdminOrgTiersPanel />
      )}
    </>
  )
}
