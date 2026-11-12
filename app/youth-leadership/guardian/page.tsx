'use client'

import { Suspense } from 'react'
import YouthShell from '@/features/youth-leadership/components/YouthShell'
import YouthSkeleton from '@/features/youth-leadership/components/YouthSkeleton'
import GuardianApplicationsPanel from '@/features/youth-leadership/components/panels/GuardianApplicationsPanel'
import GuardianMentorshipsPanel from '@/features/youth-leadership/components/panels/GuardianMentorshipsPanel'
import { useYouthTab } from '@/features/youth-leadership/hooks/useYouthTab'
import { YOUTH_GUARDIAN_TABS } from '@/features/youth-leadership/constants/nav'

const TAB_IDS = YOUTH_GUARDIAN_TABS.map((t) => t.id)
type GuardianTab = (typeof TAB_IDS)[number]

function GuardianHub() {
  const [tab, setTab] = useYouthTab(TAB_IDS, 'applications')

  return (
    <YouthShell
      title="Guardian Approvals"
      subtitle={
        tab === 'mentorships'
          ? 'Approve or reject mentorship matches that need parent or guardian authorization.'
          : 'Review program applications that need parent or guardian authorization. Private family details stay hidden.'
      }
      tabs={[...YOUTH_GUARDIAN_TABS]}
      activeTab={tab}
      onTabChange={(id) => setTab(id as GuardianTab)}
    >
      {tab === 'applications' ? <GuardianApplicationsPanel /> : null}
      {tab === 'mentorships' ? <GuardianMentorshipsPanel /> : null}
    </YouthShell>
  )
}

export default function YouthGuardianPage() {
  return (
    <Suspense
      fallback={
        <YouthShell title="Guardian Approvals" subtitle="Loading…">
          <YouthSkeleton count={3} variant="row" />
        </YouthShell>
      }
    >
      <GuardianHub />
    </Suspense>
  )
}
