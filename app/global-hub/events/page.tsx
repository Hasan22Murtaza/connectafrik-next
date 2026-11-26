'use client'

import GschPageShell from '@/features/gsch/components/GschPageShell'
import EventsPanel from '@/features/gsch/components/panels/EventsPanel'

export default function GlobalHubEventsPage() {
  return (
    <GschPageShell
      title="Global Events"
      subtitle="Conferences, trade missions, workshops, and networking across the Global Sister Cities Hub."
    >
      <EventsPanel />
    </GschPageShell>
  )
}
