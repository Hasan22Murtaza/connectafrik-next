'use client'

import { Suspense } from 'react'
import YouthShell from '@/features/youth-leadership/components/YouthShell'
import YouthSkeleton from '@/features/youth-leadership/components/YouthSkeleton'
import DiscoverProgramsPanel from '@/features/youth-leadership/components/panels/DiscoverProgramsPanel'
import MyProgramsPanel from '@/features/youth-leadership/components/panels/MyProgramsPanel'
import ApplicationsPanel from '@/features/youth-leadership/components/panels/ApplicationsPanel'
import { useYouthTab } from '@/features/youth-leadership/hooks/useYouthTab'
import { YOUTH_PROGRAMS_TABS } from '@/features/youth-leadership/constants/nav'

const TAB_IDS = YOUTH_PROGRAMS_TABS.map((t) => t.id)
type ProgramsTab = (typeof TAB_IDS)[number]

function ProgramsHub() {
  const [tab, setTab] = useYouthTab(TAB_IDS, 'discover')

  const subtitle =
    tab === 'enrolled'
      ? 'Active cohorts and completed pathways you’re enrolled in.'
      : tab === 'applications'
        ? 'Track every program you’ve applied to, including guardian approval steps.'
        : 'Find scholarships, accelerators, and leadership pathways matched to you.'

  return (
    <YouthShell
      title="Programs"
      subtitle={subtitle}
      tabs={[...YOUTH_PROGRAMS_TABS]}
      activeTab={tab}
      onTabChange={(id) => setTab(id as ProgramsTab)}
    >
      {tab === 'discover' ? <DiscoverProgramsPanel /> : null}
      {tab === 'enrolled' ? <MyProgramsPanel /> : null}
      {tab === 'applications' ? <ApplicationsPanel /> : null}
    </YouthShell>
  )
}

export default function YouthLeadershipProgramsPage() {
  return (
    <Suspense
      fallback={
        <YouthShell title="Programs" subtitle="Loading…">
          <YouthSkeleton count={6} />
        </YouthShell>
      }
    >
      <ProgramsHub />
    </Suspense>
  )
}
