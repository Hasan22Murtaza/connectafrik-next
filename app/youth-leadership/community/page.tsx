'use client'

import { Suspense } from 'react'
import YouthShell from '@/features/youth-leadership/components/YouthShell'
import YouthSkeleton from '@/features/youth-leadership/components/YouthSkeleton'
import ProjectsPanel from '@/features/youth-leadership/components/panels/ProjectsPanel'
import EventsPanel from '@/features/youth-leadership/components/panels/EventsPanel'
import { useYouthTab } from '@/features/youth-leadership/hooks/useYouthTab'
import { YOUTH_COMMUNITY_TABS } from '@/features/youth-leadership/constants/nav'

const TAB_IDS = YOUTH_COMMUNITY_TABS.map((t) => t.id)
type CommunityTab = (typeof TAB_IDS)[number]

function CommunityHub() {
  const [tab, setTab] = useYouthTab(TAB_IDS, 'projects')

  return (
    <YouthShell
      title="Community"
      subtitle={
        tab === 'events'
          ? 'Register for workshops and sessions, or publish events for your organization.'
          : 'Join open projects or create one as a coordinator.'
      }
      tabs={[...YOUTH_COMMUNITY_TABS]}
      activeTab={tab}
      onTabChange={(id) => setTab(id as CommunityTab)}
    >
      {tab === 'projects' ? <ProjectsPanel /> : null}
      {tab === 'events' ? <EventsPanel /> : null}
    </YouthShell>
  )
}

export default function YouthCommunityPage() {
  return (
    <Suspense
      fallback={
        <YouthShell title="Community" subtitle="Loading…">
          <YouthSkeleton count={4} />
        </YouthShell>
      }
    >
      <CommunityHub />
    </Suspense>
  )
}
