'use client'

import GschPageShell from '@/features/gsch/components/GschPageShell'
import CitiesManagePanel from '@/features/gsch/components/panels/CitiesManagePanel'

export default function GlobalHubCitiesPage() {
  return (
    <GschPageShell
      title="City profiles"
      subtitle="Create and manage city profiles linked to your organizations."
    >
      <CitiesManagePanel />
    </GschPageShell>
  )
}
