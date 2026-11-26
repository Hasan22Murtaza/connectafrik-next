'use client'

import GschPageShell from '@/features/gsch/components/GschPageShell'
import TourismCollaborationPanel from '@/features/gsch/components/panels/TourismCollaborationPanel'

export default function GlobalHubTourismPage() {
  return (
    <GschPageShell
      title="Eco-Tourism Collaboration"
      subtitle="Partner on eco, cultural, indigenous, and adventure tourism across the hub."
    >
      <TourismCollaborationPanel />
    </GschPageShell>
  )
}
