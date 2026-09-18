'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { ComponentType } from 'react'
import {
  Ban,
  ChevronRight,
  Eye,
  Globe,
  Lock,
  Mail,
  MapPin,
  Phone,
  Users,
  UserPlus,
  Image,
  Activity,
} from '@/shared/icons'
import { useProfile } from '@/shared/hooks/useProfile'
import type { ProfileVisibilityLevel } from '@/shared/types'
import toast from 'react-hot-toast'
import {
  Divider,
  SettingsCard,
  SettingsChoiceRow,
  SettingsPanelSkeleton,
  SettingsSaveBar,
  SettingsSectionHeader,
  SettingsToggleRow,
} from './SettingsPrimitives'

type PrivacyState = {
  profile_visibility: ProfileVisibilityLevel
  post_visibility: ProfileVisibilityLevel
  allow_comments: ProfileVisibilityLevel
  allow_follows: ProfileVisibilityLevel
  allow_direct_messages: ProfileVisibilityLevel
  show_online_status: boolean
  show_last_seen: boolean
  show_location: boolean
  show_phone: boolean
  show_email: boolean
  show_followers: boolean
  show_following: boolean
  show_country: boolean
  show_followers_count: boolean
  show_read_receipts: boolean
  is_record: boolean
  is_capture: boolean
}

const defaultPrivacy: PrivacyState = {
  profile_visibility: 'public',
  post_visibility: 'public',
  allow_comments: 'everyone',
  allow_follows: 'everyone',
  allow_direct_messages: 'everyone',
  show_online_status: true,
  show_last_seen: true,
  show_location: true,
  show_phone: false,
  show_email: false,
  show_followers: true,
  show_following: true,
  show_country: true,
  show_followers_count: true,
  show_read_receipts: true,
  is_record: true,
  is_capture: true,
}

type Choice<T extends string> = {
  value: T
  label: string
  desc: string
  icon: ComponentType<{ className?: string }>
}

const PROFILE_VISIBILITY: Choice<ProfileVisibilityLevel>[] = [
  { value: 'public', label: 'Public', desc: 'Anyone can see your profile', icon: Globe },
  { value: 'friends', label: 'Friends Only', desc: 'Only people you follow and who follow you', icon: Users },
  { value: 'private', label: 'Private', desc: 'Only you can see your profile', icon: Lock },
]

const POST_VISIBILITY: Choice<ProfileVisibilityLevel>[] = [
  { value: 'public', label: 'Everyone', desc: 'Anyone can see your posts and reels', icon: Globe },
  { value: 'friends', label: 'Friends Only', desc: 'Only people you follow and who follow you', icon: Users },
  { value: 'private', label: 'Only Me', desc: 'Only you can see your posts', icon: Eye },
]

const COMMENT_ACCESS: Choice<ProfileVisibilityLevel>[] = [
  { value: 'everyone', label: 'Everyone', desc: 'Anyone can comment on your posts', icon: Globe },
  { value: 'friends', label: 'Friends Only', desc: 'Only friends can comment', icon: Users },
  { value: 'none', label: 'No One', desc: 'Turn comments off on your posts', icon: Lock },
]

const FOLLOW_ACCESS: Choice<ProfileVisibilityLevel>[] = [
  { value: 'everyone', label: 'Everyone', desc: 'Anyone can send you a friend request', icon: Globe },
  { value: 'friends', label: 'Friends Only', desc: 'Only people already connected to you', icon: Users },
  { value: 'none', label: 'No One', desc: 'Nobody can send you a new friend request', icon: Lock },
]

const MESSAGE_ACCESS: Choice<ProfileVisibilityLevel>[] = [
  { value: 'everyone', label: 'Everyone', desc: 'Anyone can send you a message', icon: Globe },
  { value: 'friends', label: 'Friends Only', desc: 'Only friends can message you', icon: Users },
  { value: 'none', label: 'No One', desc: 'Nobody can start a new conversation with you', icon: Lock },
]

export function PrivacySettingsPanel() {
  const { profile, loading, updateProfile } = useProfile()
  const [privacy, setPrivacy] = useState<PrivacyState>(defaultPrivacy)
  const [saved, setSaved] = useState<PrivacyState>(defaultPrivacy)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!profile) return
    const next: PrivacyState = {
      profile_visibility: profile.profile_visibility || 'public',
      post_visibility: profile.post_visibility || 'public',
      allow_comments: profile.allow_comments || 'everyone',
      allow_follows: profile.allow_follows || 'everyone',
      allow_direct_messages: profile.allow_direct_messages || 'everyone',
      show_online_status: profile.show_online_status ?? true,
      show_last_seen: profile.show_last_seen ?? true,
      show_location: profile.show_location ?? true,
      show_phone: profile.show_phone ?? false,
      show_email: profile.show_email ?? false,
      show_followers: profile.show_followers ?? true,
      show_following: profile.show_following ?? true,
      show_country: profile.show_country ?? true,
      show_followers_count: profile.show_followers_count ?? true,
      is_record: profile.is_record ?? true,
      is_capture: profile.is_capture ?? true,
      show_read_receipts: profile.show_read_receipts ?? true,
    }
    setPrivacy(next)
    setSaved(next)
  }, [profile])

  const dirty = useMemo(() => JSON.stringify(privacy) !== JSON.stringify(saved), [privacy, saved])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const { error } = await updateProfile(privacy)
      if (error) {
        toast.error(error)
      } else {
        toast.success('Privacy settings updated successfully!')
        setSaved(privacy)
      }
    } catch {
      toast.error('Failed to update privacy settings')
    } finally {
      setIsSaving(false)
    }
  }

  if (loading && !profile) return <SettingsPanelSkeleton />

  return (
    <div className="space-y-4">
      <ChoiceSection
        title="Profile Visibility"
        description="Choose who can view your profile."
        name="profile_visibility"
        value={privacy.profile_visibility}
        options={PROFILE_VISIBILITY}
        onChange={(profile_visibility) => setPrivacy({ ...privacy, profile_visibility })}
      />

      <ChoiceSection
        title="Post Visibility"
        description="Control who sees your posts and who can comment."
        name="post_visibility"
        value={privacy.post_visibility}
        options={POST_VISIBILITY}
        onChange={(post_visibility) => setPrivacy({ ...privacy, post_visibility })}
      />

      <ChoiceSection
        title="Comments"
        description="Who can comment on your posts."
        name="allow_comments"
        value={privacy.allow_comments}
        options={COMMENT_ACCESS}
        onChange={(allow_comments) => setPrivacy({ ...privacy, allow_comments })}
      />

      <ChoiceSection
        title="Who Can Send Friend Requests"
        description="Choose who is allowed to follow or add you."
        name="allow_follows"
        value={privacy.allow_follows}
        options={FOLLOW_ACCESS}
        onChange={(allow_follows) => setPrivacy({ ...privacy, allow_follows })}
      />

      <ChoiceSection
        title="Who Can Message You"
        description="Control who can start a conversation."
        name="allow_direct_messages"
        value={privacy.allow_direct_messages}
        options={MESSAGE_ACCESS}
        onChange={(allow_direct_messages) => setPrivacy({ ...privacy, allow_direct_messages })}
      />

      <SettingsCard>
        <SettingsSectionHeader
          title="Who Can Call You"
          description="Voice and video calls stay limited to people you already know."
        />
        <div className="flex items-start gap-3 px-4 py-4 sm:px-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-surface-secondary text-content-secondary">
            <Phone className="h-[18px] w-[18px]" aria-hidden />
          </div>
          <div>
            <div className="text-[15px] font-medium text-content">Friends only</div>
            <p className="mt-0.5 text-sm leading-5 text-content-secondary">
              Only people you’re friends with can call you. This can’t be changed.
            </p>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard>
        <SettingsSectionHeader title="Online Status" description="Choose what people see when you’re active." />
        <SettingsToggleRow
          icon={Activity}
          title="Show when you’re online"
          description="Friends can see when you’re active"
          checked={privacy.show_online_status}
          onChange={(show_online_status) => setPrivacy({ ...privacy, show_online_status })}
        />
        <Divider />
        <SettingsToggleRow
          icon={Eye}
          title="Show last seen"
          description="Let people see when you were last active"
          checked={privacy.show_last_seen}
          onChange={(show_last_seen) => setPrivacy({ ...privacy, show_last_seen })}
        />
        <Divider />
        <SettingsToggleRow
          icon={Mail}
          title="Read receipts"
          description="Let others see when you’ve read their messages"
          checked={privacy.show_read_receipts}
          onChange={(show_read_receipts) => setPrivacy({ ...privacy, show_read_receipts })}
        />
      </SettingsCard>

      <SettingsCard>
        <SettingsSectionHeader title="What others can see" description="Details that appear on your profile." />
        {[
          { key: 'show_country' as const, icon: Globe, title: 'Country', description: 'Show your country on your profile' },
          { key: 'show_location' as const, icon: MapPin, title: 'Location', description: 'Show your location on your profile' },
          { key: 'show_phone' as const, icon: Phone, title: 'Phone number', description: 'Show your phone number on your profile' },
          { key: 'show_email' as const, icon: Mail, title: 'Email', description: 'Show your email on your profile' },
          { key: 'show_followers' as const, icon: Users, title: 'Followers list', description: 'Let people see who follows you' },
          { key: 'show_following' as const, icon: UserPlus, title: 'Following list', description: 'Let people see who you follow' },
          { key: 'show_followers_count' as const, icon: Users, title: 'Follower count', description: 'Show how many people follow you' },
        ].map((item, index) => (
          <React.Fragment key={item.key}>
            {index > 0 ? <Divider /> : null}
            <SettingsToggleRow
              icon={item.icon}
              title={item.title}
              description={item.description}
              checked={privacy[item.key]}
              onChange={(next) => setPrivacy({ ...privacy, [item.key]: next })}
            />
          </React.Fragment>
        ))}
      </SettingsCard>

      <SettingsCard>
        <SettingsSectionHeader title="Calls & chats" description="Extra privacy during conversations." />
        <SettingsToggleRow
          icon={Phone}
          title="Allow call recording"
          description="Let others record calls with you"
          checked={privacy.is_record}
          onChange={(is_record) => setPrivacy({ ...privacy, is_record })}
        />
        <Divider />
        <SettingsToggleRow
          icon={Image}
          title="Allow screenshots"
          description="Let others capture your chats"
          checked={privacy.is_capture}
          onChange={(is_capture) => setPrivacy({ ...privacy, is_capture })}
        />
      </SettingsCard>

      <SettingsCard>
        <SettingsSectionHeader
          title="Blocked Users"
          description="People you’ve blocked can’t message or follow you."
        />
        <Link
          href="/chat"
          className="flex min-h-11 items-center justify-between gap-3 px-4 py-3.5 transition-colors duration-200 hover:bg-surface-hover sm:px-5"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-surface-secondary text-content-secondary">
              <Ban className="h-[18px] w-[18px]" aria-hidden />
            </div>
            <div>
              <div className="text-[15px] font-medium text-content">Manage blocked contacts</div>
              <p className="mt-0.5 text-sm text-content-secondary">Open Chat to review or unblock people.</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-content-tertiary" aria-hidden />
        </Link>
      </SettingsCard>

      <SettingsSaveBar dirty={dirty} saving={isSaving} onSave={handleSave} />
    </div>
  )
}

function ChoiceSection({
  title,
  description,
  name,
  value,
  options,
  onChange,
}: {
  title: string
  description: string
  name: string
  value: ProfileVisibilityLevel
  options: Choice<ProfileVisibilityLevel>[]
  onChange: (value: ProfileVisibilityLevel) => void
}) {
  return (
    <SettingsCard>
      <SettingsSectionHeader title={title} description={description} />
      <div>
        {options.map((option, index) => (
          <React.Fragment key={option.value}>
            {index > 0 ? <Divider /> : null}
            <SettingsChoiceRow
              icon={option.icon}
              title={option.label}
              description={option.desc}
              selected={value === option.value}
              onSelect={() => onChange(option.value)}
              name={name}
              value={option.value}
            />
          </React.Fragment>
        ))}
      </div>
    </SettingsCard>
  )
}
