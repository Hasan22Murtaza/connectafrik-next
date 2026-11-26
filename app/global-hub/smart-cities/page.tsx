'use client'

import GschPageShell from '@/features/gsch/components/GschPageShell'
import SmartCitiesLabPanel from '@/features/gsch/components/panels/SmartCitiesLabPanel'

export default function GlobalHubSmartCitiesPage() {
  return (
    <GschPageShell
      title="Smart Cities Innovation Lab"
      subtitle="Open challenges for mobility, digital twins, public safety, and urban innovation."
    >
      <SmartCitiesLabPanel />
    </GschPageShell>
  )
}
