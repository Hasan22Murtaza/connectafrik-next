'use client'

import React from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { FamilySettingsPanel } from '@/features/settings/components/FamilySettingsPanel'
import { SettingsSignInPrompt } from '@/features/settings/components/SettingsPrimitives'

export default function FamilyCirclePage() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return (
      <SettingsSignInPrompt message="You need to be signed in to manage Family Circle." />
    )
  }

  return (
    <div className="flex min-h-[calc(100dvh-4.5rem)] bg-background sm:mb-0 mb-10">
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
          <div className="mb-5 border-b border-border-subtle pb-4">
            <h1 className="text-xl font-semibold tracking-tight text-content">
              Family & Parental Controls
            </h1>
            <p className="mt-1 text-sm leading-5 text-content-secondary">
              Manage family members, permissions, screen time, and safety alerts.
            </p>
          </div>
          <FamilySettingsPanel />
        </div>
      </div>
    </div>
  )
}
