'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { AtSign, Bell, Heart, Mail, MessageCircle, Settings, UserPlus, Image } from '@/shared/icons'
import { useProfile } from '@/shared/hooks/useProfile'
import NotificationManager from '@/shared/components/ui/NotificationManager'
import toast from 'react-hot-toast'
import {
  Divider,
  SettingsCard,
  SettingsPanelSkeleton,
  SettingsSaveBar,
  SettingsSectionHeader,
  SettingsToggleRow,
} from './SettingsPrimitives'

type NotificationState = {
  email_notifications: boolean
  push_notifications: boolean
  comment_notifications: boolean
  like_notifications: boolean
  follow_notifications: boolean
  message_notifications: boolean
  mention_notifications: boolean
  post_updates: boolean
}

const defaultNotifications: NotificationState = {
  email_notifications: true,
  push_notifications: true,
  comment_notifications: true,
  like_notifications: true,
  follow_notifications: true,
  message_notifications: true,
  mention_notifications: true,
  post_updates: false,
}

export function NotificationSettingsPanel() {
  const { profile, loading, updateProfile } = useProfile()
  const [settings, setSettings] = useState<NotificationState>(defaultNotifications)
  const [saved, setSaved] = useState<NotificationState>(defaultNotifications)
  const [isSaving, setIsSaving] = useState(false)
  const [showNotificationManager, setShowNotificationManager] = useState(false)

  useEffect(() => {
    if (!profile) return
    const next: NotificationState = {
      email_notifications: profile.email_notifications ?? true,
      push_notifications: profile.push_notifications ?? true,
      comment_notifications: profile.comment_notifications ?? true,
      like_notifications: profile.like_notifications ?? true,
      follow_notifications: profile.follow_notifications ?? true,
      message_notifications: profile.message_notifications ?? true,
      mention_notifications: profile.mention_notifications ?? true,
      post_updates: profile.post_updates ?? false,
    }
    setSettings(next)
    setSaved(next)
  }, [profile])

  const dirty = useMemo(() => JSON.stringify(settings) !== JSON.stringify(saved), [settings, saved])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const { error } = await updateProfile(settings)
      if (error) {
        toast.error(error)
      } else {
        toast.success('Notification preferences updated successfully!')
        setSaved(settings)
      }
    } catch {
      toast.error('Failed to update notification settings')
    } finally {
      setIsSaving(false)
    }
  }

  if (loading && !profile) return <SettingsPanelSkeleton />

  return (
    <div className="space-y-4">
      <SettingsCard>
        <SettingsSectionHeader
          title="Push Notifications"
          description="Alerts on this device for requests, messages, and calls."
        />
        <SettingsToggleRow
          icon={Bell}
          title="Push notifications"
          description="Receive alerts in this browser or app"
          checked={settings.push_notifications}
          onChange={(push_notifications) => setSettings({ ...settings, push_notifications })}
        />
        <Divider />
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <div className="text-[15px] font-medium text-content">Device permission</div>
            <p className="mt-0.5 text-sm text-content-secondary">
              Allow ConnectAfrik to send notifications on this device.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNotificationManager(true)}
            className="btn-secondary min-h-11 shrink-0 rounded-[14px] px-4 space-x-0.5"
          >
            <Settings className="h-4 w-4" />
            <span>Configure</span>
          </button>
        </div>
      </SettingsCard>

      <SettingsCard>
        <SettingsSectionHeader title="Friend Requests" description="Stay informed when someone wants to connect." />
        <SettingsToggleRow
          icon={UserPlus}
          title="New followers"
          description="When someone follows you or sends a request"
          checked={settings.follow_notifications}
          onChange={(follow_notifications) => setSettings({ ...settings, follow_notifications })}
        />
      </SettingsCard>

      <SettingsCard>
        <SettingsSectionHeader title="Messages" description="Alerts for direct conversations." />
        <SettingsToggleRow
          icon={MessageCircle}
          title="Direct messages"
          description="When someone sends you a message"
          checked={settings.message_notifications}
          onChange={(message_notifications) => setSettings({ ...settings, message_notifications })}
        />
      </SettingsCard>

      <SettingsCard>
        <SettingsSectionHeader
          title="Post & reel activity"
          description="Updates about your content and people you follow."
        />
        <SettingsToggleRow
          icon={MessageCircle}
          title="Comments"
          description="When someone comments on your posts"
          checked={settings.comment_notifications}
          onChange={(comment_notifications) => setSettings({ ...settings, comment_notifications })}
        />
        <Divider />
        <SettingsToggleRow
          icon={Heart}
          title="Likes"
          description="When someone likes your posts or comments"
          checked={settings.like_notifications}
          onChange={(like_notifications) => setSettings({ ...settings, like_notifications })}
        />
        <Divider />
        <SettingsToggleRow
          icon={AtSign}
          title="Mentions"
          description="When someone mentions you in a post"
          checked={settings.mention_notifications}
          onChange={(mention_notifications) => setSettings({ ...settings, mention_notifications })}
        />
        <Divider />
        <SettingsToggleRow
          icon={Image}
          title="Post updates"
          description="Updates from people you follow"
          checked={settings.post_updates}
          onChange={(post_updates) => setSettings({ ...settings, post_updates })}
        />
      </SettingsCard>

      <SettingsCard>
        <SettingsSectionHeader title="Email Notifications" description="Summaries and alerts sent to your inbox." />
        <SettingsToggleRow
          icon={Mail}
          title="Email notifications"
          description="Receive notifications via email"
          checked={settings.email_notifications}
          onChange={(email_notifications) => setSettings({ ...settings, email_notifications })}
        />
      </SettingsCard>

      <SettingsSaveBar dirty={dirty} saving={isSaving} onSave={handleSave} />

      {showNotificationManager ? (
        <NotificationManager onClose={() => setShowNotificationManager(false)} />
      ) : null}
    </div>
  )
}
