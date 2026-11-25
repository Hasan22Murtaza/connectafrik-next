'use client'

import GschPageShell from '@/features/gsch/components/GschPageShell'
import TourismCollaborationPanel from '@/features/gsch/components/panels/TourismCollaborationPanel'

export default function GlobalHubTourismPage() {
  return (
    <GschPageShell
      title="Eco-Tourism Collaboration"
      subtitle="Discover and partner on eco, cultural, indigenous, and adventure tourism initiatives."
    >
      <TourismCollaborationPanel />
    </GschPageShell>
  )
}
