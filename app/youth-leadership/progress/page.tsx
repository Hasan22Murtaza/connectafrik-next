'use client'

import { Suspense } from 'react'
import YouthShell from '@/features/youth-leadership/components/YouthShell'
import YouthSkeleton from '@/features/youth-leadership/components/YouthSkeleton'
import DashboardPanel from '@/features/youth-leadership/components/panels/DashboardPanel'
import AchievementsPanel from '@/features/youth-leadership/components/panels/AchievementsPanel'
import { useYouthTab } from '@/features/youth-leadership/hooks/useYouthTab'
import { YOUTH_PROGRESS_TABS } from '@/features/youth-leadership/constants/nav'

const TAB_IDS = YOUTH_PROGRESS_TABS.map((t) => t.id)
type ProgressTab = (typeof TAB_IDS)[number]

function ProgressHub() {
  const [tab, setTab] = useYouthTab(TAB_IDS, 'overview')

  return (
    <YouthShell
      title="Progress"
      subtitle={
        tab === 'achievements'
          ? 'Certificates and badges verified by coordinators or admins.'
          : 'Programs, projects, mentorship, and upcoming deadlines at a glance.'
      }
      tabs={[...YOUTH_PROGRESS_TABS]}
      activeTab={tab}
      onTabChange={(id) => setTab(id as ProgressTab)}
    >
      {tab === 'overview' ? <DashboardPanel /> : null}
      {tab === 'achievements' ? <AchievementsPanel /> : null}
    </YouthShell>
  )
}

export default function YouthProgressPage() {
  return (
    <Suspense
      fallback={
        <YouthShell title="Progress" subtitle="Loading…">
          <YouthSkeleton count={6} variant="stat" />
        </YouthShell>
      }
    >
      <ProgressHub />
    </Suspense>
  )
}
