'use client'

import GschPageShell from '@/features/gsch/components/GschPageShell'
import OrganizationPanel from '@/features/gsch/components/panels/OrganizationPanel'

export default function GlobalHubOrganizationPage() {
  return (
    <GschPageShell
      title="Organization"
      subtitle="Register your municipality, agency, business, or institution on the Global Hub."
    >
      <OrganizationPanel />
    </GschPageShell>
  )
}
