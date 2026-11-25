'use client'

import GschPageShell from '@/features/gsch/components/GschPageShell'
import DiscoverCitiesPanel from '@/features/gsch/components/panels/DiscoverCitiesPanel'

export default function GlobalHubDiscoverPage() {
  return (
    <GschPageShell
      title="Discover cities"
      subtitle="Search published city profiles by region, industry, and collaboration interests."
    >
      <DiscoverCitiesPanel />
    </GschPageShell>
  )
}
