'use client'

import GschPageShell from '@/features/gsch/components/GschPageShell'
import EventsPanel from '@/features/gsch/components/panels/EventsPanel'

export default function GlobalHubEventsPage() {
  return (
    <GschPageShell
      title="Global Events"
      subtitle="Publish and discover conferences, trade missions, workshops, and networking events."
    >
      <EventsPanel />
    </GschPageShell>
  )
}
