'use client'

import GschPageShell from '@/features/gsch/components/GschPageShell'
import DiscoverCitiesPanel from '@/features/gsch/components/panels/DiscoverCitiesPanel'

export default function GlobalHubDiscoverPage() {
  return (
    <GschPageShell
      title="Discover"
      subtitle="Browse published sister city profiles and save communities you want to follow."
    >
      <DiscoverCitiesPanel />
    </GschPageShell>
  )
}
