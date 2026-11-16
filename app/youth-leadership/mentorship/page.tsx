'use client'

import { Suspense } from 'react'
import YouthShell from '@/features/youth-leadership/components/YouthShell'
import YouthSkeleton from '@/features/youth-leadership/components/YouthSkeleton'
import MentorsPanel from '@/features/youth-leadership/components/panels/MentorsPanel'
import MentorshipMatchesPanel from '@/features/youth-leadership/components/panels/MentorshipMatchesPanel'
import { useYouthTab } from '@/features/youth-leadership/hooks/useYouthTab'
import { YOUTH_MENTORSHIP_TABS } from '@/features/youth-leadership/constants/nav'

const TAB_IDS = YOUTH_MENTORSHIP_TABS.map((t) => t.id)
type MentorshipTab = (typeof TAB_IDS)[number]

function MentorshipHub() {
  const [tab, setTab] = useYouthTab(TAB_IDS, 'mentors')

  return (
    <YouthShell
      title="Mentorship"
      subtitle={
        tab === 'matches'
          ? 'Track requests, accept mentees, and manage active mentorships.'
          : 'Browse verified mentors, request matches, and manage your mentor profile.'
      }
      tabs={[...YOUTH_MENTORSHIP_TABS]}
      activeTab={tab}
      onTabChange={(id) => setTab(id as MentorshipTab)}
    >
      {tab === 'mentors' ? <MentorsPanel /> : null}
      {tab === 'matches' ? <MentorshipMatchesPanel /> : null}
    </YouthShell>
  )
}

export default function YouthMentorshipPage() {
  return (
    <Suspense
      fallback={
        <YouthShell title="Mentorship" subtitle="Loading…">
          <YouthSkeleton count={4} />
        </YouthShell>
      }
    >
      <MentorshipHub />
    </Suspense>
  )
}
