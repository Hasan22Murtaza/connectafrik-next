'use client'

import React, { Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { parseSettingsTab, type SettingsTab } from '../types'
import { SettingsShell } from './SettingsShell'
import { ProfileSettingsPanel } from './ProfileSettingsPanel'
import { PrivacySettingsPanel } from './PrivacySettingsPanel'
import { NotificationSettingsPanel } from './NotificationSettingsPanel'
import { SecuritySettingsPanel } from './SecuritySettingsPanel'
import { SettingsSignInPrompt } from './SettingsPrimitives'

const PANEL_COPY: Record<SettingsTab, { title: string; description: string }> = {
  profile: {
    title: 'Profile',
    description: 'Update how you appear to other people on ConnectAfrik.',
  },
  privacy: {
    title: 'Privacy',
    description: 'Control who can see your content and interact with you.',
  },
  notifications: {
    title: 'Notifications',
    description: 'Choose what you want to hear about, and how.',
  },
  security: {
    title: 'Security',
    description: 'Protect your account, devices, and sign-in details.',
  },
}

function SettingsExperienceInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { user } = useAuth()

  const activeTab = parseSettingsTab(pathname, searchParams.get('tab'))
  const displayTab: SettingsTab = activeTab === 'hub' ? 'profile' : activeTab
  const copy = PANEL_COPY[displayTab]

  if (!user) {
    return <SettingsSignInPrompt message="You need to be signed in to view your settings." />
  }

  return (
    <SettingsShell activeTab={activeTab} title={copy.title} description={copy.description}>
      {displayTab === 'profile' ? <ProfileSettingsPanel /> : null}
      {displayTab === 'privacy' ? <PrivacySettingsPanel /> : null}
      {displayTab === 'notifications' ? <NotificationSettingsPanel /> : null}
      {displayTab === 'security' ? <SecuritySettingsPanel /> : null}
    </SettingsShell>
  )
}

export function SettingsExperience() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <SettingsExperienceInner />
    </Suspense>
  )
}
