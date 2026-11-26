'use client'

import GschPageShell from '@/features/gsch/components/GschPageShell'
import OrganizationPanel from '@/features/gsch/components/panels/OrganizationPanel'

export default function GlobalHubOrganizationPage() {
  return (
    <GschPageShell
      title="Organizations"
      subtitle="Register and manage the municipalities, agencies, or institutions you represent."
    >
      <OrganizationPanel />
    </GschPageShell>
  )
}
