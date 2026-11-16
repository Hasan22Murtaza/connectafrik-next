'use client'

import React, { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Activity,
  AlertTriangle,
  Award,
  Clock,
  Eye,
  Film,
  Image,
  Mail,
  MessageSquare,
  Mic,
  Phone,
  Shield,
  ShoppingBag,
  Trash2,
  User,
  UserCheck,
  UserPlus,
  Users,
  Video,
} from '@/shared/icons'
import { REEL_CATEGORIES } from '@/shared/types/reels'
import {
  SettingsCard,
  SettingsSectionHeader,
  SettingsToggleRow,
  settingsInputClass,
  settingsLabelClass,
} from './SettingsPrimitives'
import { familyService, type FamilyMeStatus, type FamilyOverview } from '../services/familyService'
import {
  areAllMessageTypesLocked,
  type ActivitySummary,
  type FamilyInvitation,
  type FamilyMember,
  type FamilyMemberRole,
  type ParentalControls,
  type SafetyAlert,
  type ScreenTimeDailyHistory,
  type ScreenTimeRules,
} from '@/shared/types/family'
import { ApiError } from '@/lib/api-client'
import { useProfile } from '@/shared/hooks/useProfile'
import { isAdultForFamily } from '@/lib/family/age'
import { isManagedRole } from '@/lib/family/auth'
import { ScreenTimeUsageChart } from '@/features/family/components/ScreenTimeUsageChart'

type MemberView = 'list' | 'controls' | 'screen-time' | 'activity' | 'alerts' | 'friends'
type SettingsIcon = React.ComponentType<{ className?: string }>

const AVATAR_FALLBACK = '/assets/images/profile-dp.svg'

function formatMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h <= 0) return `${m}m`
  return `${h}h ${m}m`
}

function memberLabel(m: FamilyMember) {
  return m.profile?.full_name || m.profile?.username || 'Member'
}

function memberInitials(m: FamilyMember) {
  const name = memberLabel(m).trim()
  if (!name || name === 'Member') return '?'
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

function roleLabel(role: string) {
  if (role === 'parent') return 'Parent'
  if (role === 'teen') return 'Teen'
  return 'Child'
}

function MemberAvatar({
  avatarUrl,
  name,
  initials,
  size = 'md',
}: {
  avatarUrl?: string | null
  name: string
  initials?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const sizeClass =
    size === 'lg' ? 'h-14 w-14 text-base' : size === 'sm' ? 'h-9 w-9 text-xs' : 'h-11 w-11 text-sm'
  const src = avatarUrl && avatarUrl !== failedUrl ? avatarUrl : null

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-secondary text-content-secondary ring-2 ring-surface ${sizeClass}`}
    >
      {src ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailedUrl(src)}
        />
      ) : initials ? (
        <span className="font-semibold text-primary" aria-hidden>
          {initials}
        </span>
      ) : (
        <img src={AVATAR_FALLBACK} alt="" className="h-full w-full object-cover" />
      )}
      <span className="sr-only">{name}</span>
    </div>
  )
}

function RoleBadge({ role }: { role: string }) {
  const styles =
    role === 'parent'
      ? 'bg-primary/10 text-primary'
      : role === 'teen'
        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
        : 'bg-sky-500/10 text-sky-700 dark:text-sky-400'

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide ${styles}`}
    >
      {roleLabel(role)}
    </span>
  )
}

export function FamilySettingsPanel() {
  const { profile } = useProfile()
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<FamilyOverview | null>(null)
  const [me, setMe] = useState<FamilyMeStatus | null>(null)
  const [invites, setInvites] = useState<FamilyInvitation[]>([])
  const [familyName, setFamilyName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<FamilyMemberRole>('child')
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null)
  const [memberView, setMemberView] = useState<MemberView>('list')
  const [controls, setControls] = useState<ParentalControls | null>(null)
  const [screenTime, setScreenTime] = useState<ScreenTimeRules | null>(null)
  const [usedMinutes, setUsedMinutes] = useState(0)
  const [screenTimeHistory, setScreenTimeHistory] = useState<ScreenTimeDailyHistory | null>(
    null
  )
  const [screenTimeRangeDays, setScreenTimeRangeDays] = useState(7)
  const [screenTimeHistoryLoading, setScreenTimeHistoryLoading] = useState(false)
  const [activity, setActivity] = useState<ActivitySummary | null>(null)
  const [alerts, setAlerts] = useState<SafetyAlert[]>([])
  const [pendingFriends, setPendingFriends] = useState<
    Array<{
      id: string
      sender: {
        full_name: string | null
        username: string | null
        avatar_url?: string | null
      } | null
    }>
  >([])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ov, meStatus, incoming] = await Promise.all([
        familyService.getOverview(),
        familyService.getMe(),
        familyService.listIncomingInvitations().catch(() => []),
      ])
      setOverview(ov)
      setMe(meStatus)
      setInvites(incoming)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load family settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const isParent = overview?.membership?.role === 'parent'
  const isManaged =
    me?.controls_active === true ||
    (overview?.membership?.role != null && isManagedRole(overview.membership.role))
  const canCreateFamily = isAdultForFamily(profile?.birthday)

  async function createFamily() {
    if (!familyName.trim()) {
      toast.error('Enter a family name')
      return
    }
    setSaving(true)
    try {
      await familyService.createFamily(familyName.trim())
      toast.success('Family created')
      setFamilyName('')
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create family')
    } finally {
      setSaving(false)
    }
  }

  async function sendInvite() {
    const email = inviteEmail.trim().toLowerCase()
    if (!overview?.family?.id || !email) {
      toast.error('Enter the member email address')
      return
    }
    if (!email.includes('@')) {
      toast.error('Enter a valid email address')
      return
    }
    setSaving(true)
    try {
      const result = await familyService.invite({
        family_id: overview.family.id,
        role: inviteRole,
        invitee_email: email,
      })
      toast.success(
        result.invitee_user_id
          ? 'Invitation sent — they will see it in Family settings'
          : 'Invitation saved for that email. They can accept after signing in with it.'
      )
      setInviteEmail('')
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to send invitation')
    } finally {
      setSaving(false)
    }
  }

  async function acceptInvite(id: string) {
    setSaving(true)
    try {
      await familyService.acceptInvitation(id)
      toast.success('Joined family')
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to accept invitation')
    } finally {
      setSaving(false)
    }
  }

  async function rejectInvite(id: string) {
    setSaving(true)
    try {
      await familyService.rejectInvitation(id)
      toast.success('Invitation declined')
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to decline invitation')
    } finally {
      setSaving(false)
    }
  }

  async function openMember(member: FamilyMember, view: MemberView) {
    setSelectedMember(member)
    setMemberView(view)
    setSaving(true)
    try {
      if (view === 'controls') {
        const loaded = await familyService.getControls(member.id)
        setControls(
          loaded
            ? {
                ...loaded,
                text_messaging_enabled: loaded.text_messaging_enabled ?? true,
                image_messaging_enabled: loaded.image_messaging_enabled ?? true,
                video_messaging_enabled: loaded.video_messaging_enabled ?? true,
                audio_messaging_enabled: loaded.audio_messaging_enabled ?? true,
                emergency_messaging_enabled: loaded.emergency_messaging_enabled ?? true,
                audio_calling_enabled: loaded.audio_calling_enabled ?? true,
                video_calling_enabled: loaded.video_calling_enabled ?? true,
                group_calling_enabled: loaded.group_calling_enabled ?? true,
                reels_restriction_enabled: loaded.reels_restriction_enabled ?? false,
                reels_allowed_categories: loaded.reels_allowed_categories ?? null,
              }
            : null
        )
      } else if (view === 'screen-time') {
        const data = await familyService.getScreenTime(member.id, screenTimeRangeDays)
        setScreenTime(data?.rules ?? null)
        setUsedMinutes(data?.used_minutes_today ?? 0)
        setScreenTimeHistory(data?.history ?? null)
      } else if (view === 'activity') {
        setActivity(await familyService.getActivity(member.id, 7))
      } else if (view === 'alerts') {
        setAlerts(await familyService.listAlerts({ member_id: member.id }))
      } else if (view === 'friends') {
        setPendingFriends(await familyService.listPendingFriendRequests(member.id))
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load member details')
      setMemberView('list')
      setSelectedMember(null)
    } finally {
      setSaving(false)
    }
  }

  async function saveControls() {
    if (!selectedMember || !controls) return
    setSaving(true)
    try {
      const updated = await familyService.updateControls(selectedMember.id, controls)
      setControls(updated)
      toast.success('Permissions saved')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to save permissions')
    } finally {
      setSaving(false)
    }
  }

  async function saveScreenTime() {
    if (!selectedMember || !screenTime) return
    setSaving(true)
    try {
      const updated = await familyService.updateScreenTime(selectedMember.id, screenTime)
      setScreenTime(updated)
      toast.success('Screen time saved')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to save screen time')
    } finally {
      setSaving(false)
    }
  }

  async function changeScreenTimeRange(days: number) {
    if (!selectedMember || days === screenTimeRangeDays) return
    setScreenTimeRangeDays(days)
    setScreenTimeHistoryLoading(true)
    try {
      const data = await familyService.getScreenTime(selectedMember.id, days)
      setScreenTimeHistory(data?.history ?? null)
      setUsedMinutes(data?.used_minutes_today ?? usedMinutes)
      if (data?.rules) setScreenTime(data.rules)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load usage history')
    } finally {
      setScreenTimeHistoryLoading(false)
    }
  }

  async function removeMember(member: FamilyMember) {
    if (!overview?.family?.id) return
    if (!window.confirm(`Remove ${memberLabel(member)} from the family?`)) return
    setSaving(true)
    try {
      await familyService.removeMember(overview.family.id, member.id)
      toast.success('Member removed')
      setSelectedMember(null)
      setMemberView('list')
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to remove member')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  // Child / teen: read-only view of what their parent manages
  if (isManaged && me) {
    return (
      <div className="space-y-4">
        <SettingsCard>
          <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-4 sm:px-5">
            <MemberAvatar
              avatarUrl={profile?.avatar_url}
              name={profile?.full_name || profile?.username || 'You'}
              initials={
                (profile?.full_name || profile?.username || 'Y')
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((p) => p[0])
                  .join('')
                  .toUpperCase() || 'Y'
              }
              size="lg"
            />
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold tracking-tight text-content">
                Family Controls
              </h3>
              <p className="mt-0.5 text-sm leading-5 text-content-secondary">
                Your parent manages some settings for your CribsTalk account.
              </p>
            </div>
          </div>
          <div className="divide-y divide-border-subtle">
            <InfoRow
              icon={UserCheck}
              label="Friend requests"
              value={
                me.controls?.friend_request_approval
                  ? 'Parent approval required'
                  : 'Allowed'
              }
            />
            <InfoRow
              icon={MessageSquare}
              label="Messaging"
              value={me.controls?.messaging_enabled === false ? 'Restricted' : 'Allowed'}
            />
            <InfoRow
              icon={Phone}
              label="Calls"
              value={me.controls?.calling_enabled === false ? 'Restricted' : 'Allowed'}
            />
            <InfoRow
              icon={Users}
              label="Groups"
              value={me.controls?.group_joining_enabled === false ? 'Restricted' : 'Allowed'}
            />
            <InfoRow
              icon={ShoppingBag}
              label="Marketplace"
              value={me.controls?.marketplace_enabled === false ? 'Restricted' : 'Allowed'}
            />
            <InfoRow
              icon={Award}
              label="Youth Leadership"
              value={
                me.controls?.youth_leadership_enabled === false ? 'Restricted' : 'Allowed'
              }
            />
            <InfoRow
              icon={Clock}
              label="Screen time"
              value={
                me.controls?.screen_time_enabled && me.screen_time?.rules?.daily_limit_minutes
                  ? `${me.screen_time.rules.daily_limit_minutes} minutes/day · used ${me.screen_time.used_minutes_today || 0}m today`
                  : me.controls?.screen_time_enabled
                    ? 'Enabled'
                    : 'Not limited'
              }
            />
          </div>
        </SettingsCard>
      </div>
    )
  }

  if (!overview?.family) {
    return (
      <div className="space-y-4">
        {invites.length > 0 ? (
          <SettingsCard>
            <SettingsSectionHeader
              title="Family invitations"
              description="Accept or decline invitations to join a family."
            />
            <ul className="divide-y divide-border-subtle">
              {invites.map((inv) => (
                <li
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Mail className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-content">
                          Join as {roleLabel(inv.role)}
                        </p>
                        <RoleBadge role={inv.role} />
                      </div>
                      <p className="text-sm text-content-secondary">
                        Expires {new Date(inv.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void acceptInvite(inv.id)}
                      className="rounded-[12px] bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void rejectInvite(inv.id)}
                      className="rounded-[12px] border border-border px-3 py-2 text-sm font-medium text-content disabled:opacity-60"
                    >
                      Decline
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </SettingsCard>
        ) : null}

        {canCreateFamily ? (
          <SettingsCard>
            <div className="flex items-start gap-3 border-b border-border-subtle px-4 py-4 sm:px-5">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-primary/10 text-primary">
                <Users className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold tracking-tight text-content">
                  Create a family
                </h3>
                <p className="mt-0.5 text-sm leading-5 text-content-secondary">
                  Set up Family & Parental Controls for child and teen accounts. Existing CribsTalk
                  features stay the same until someone joins.
                </p>
              </div>
            </div>
            <div className="space-y-4 px-4 py-4 sm:px-5">
              <div>
                <label className={settingsLabelClass} htmlFor="family-name">
                  Family name
                </label>
                <input
                  id="family-name"
                  className={settingsInputClass}
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  placeholder="e.g. The Ahmed Family"
                  maxLength={80}
                />
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => void createFamily()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[14px] bg-primary px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                <Users className="h-4 w-4" aria-hidden />
                Create family
              </button>
            </div>
          </SettingsCard>
        ) : (
          <SettingsCard>
            <div className="flex items-start gap-3 border-b border-border-subtle px-4 py-4 sm:px-5">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-surface-secondary text-content-secondary">
                <UserPlus className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold tracking-tight text-content">
                  Join a family
                </h3>
                <p className="mt-0.5 text-sm leading-5 text-content-secondary">
                  Only adults (18+) can create a family. Ask a parent to invite you by email —
                  invitations appear above when you receive one.
                </p>
              </div>
            </div>
            {invites.length === 0 ? (
              <p className="px-4 py-4 text-sm text-content-secondary sm:px-5">
                No pending invitations right now.
              </p>
            ) : null}
          </SettingsCard>
        )}
      </div>
    )
  }

  if (selectedMember && memberView !== 'list') {
    const detailTitle =
      memberView === 'controls'
        ? 'Permissions for this account'
        : memberView === 'screen-time'
          ? 'CribsTalk usage limits'
          : memberView === 'activity'
            ? 'Activity summary (counts only — no private messages)'
            : memberView === 'friends'
              ? 'Friend requests waiting for your approval'
              : 'Safety alerts for review'

    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => {
            setSelectedMember(null)
            setMemberView('list')
          }}
          className="text-sm font-medium text-primary"
        >
          ← Back to family
        </button>

        <SettingsCard>
          <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-4 sm:px-5">
            <MemberAvatar
              avatarUrl={selectedMember.profile?.avatar_url}
              name={memberLabel(selectedMember)}
              initials={memberInitials(selectedMember)}
              size="lg"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[15px] font-semibold tracking-tight text-content">
                  {memberLabel(selectedMember)}
                </h3>
                <RoleBadge role={selectedMember.role} />
              </div>
              <p className="mt-0.5 text-sm leading-5 text-content-secondary">{detailTitle}</p>
            </div>
          </div>

          {memberView === 'controls' && controls ? (
            <div className="divide-y divide-border-subtle pb-4">
              <SettingsToggleRow
                icon={UserCheck}
                title="Friend request approval"
                description="Require your approval before they accept new contacts"
                checked={controls.friend_request_approval}
                onChange={(v) => setControls({ ...controls, friend_request_approval: v })}
              />
              <SettingsToggleRow
                icon={MessageSquare}
                title="Direct messaging"
                description="Master switch for messaging. Turn off to lock all message types."
                checked={controls.messaging_enabled}
                onChange={(v) => setControls({ ...controls, messaging_enabled: v })}
              />
              {controls.messaging_enabled ? (
                <div className="space-y-0 border-l-2 border-primary/20 bg-surface-secondary/40">
                  <SettingsToggleRow
                    icon={MessageSquare}
                    title="Text messages"
                    description="Allow plain text and location messages"
                    checked={controls.text_messaging_enabled !== false}
                    onChange={(v) => setControls({ ...controls, text_messaging_enabled: v })}
                  />
                  <SettingsToggleRow
                    icon={Image}
                    title="Image messages"
                    description="Allow photos and image attachments"
                    checked={controls.image_messaging_enabled !== false}
                    onChange={(v) => setControls({ ...controls, image_messaging_enabled: v })}
                  />
                  <SettingsToggleRow
                    icon={Video}
                    title="Video messages"
                    description="Allow video attachments"
                    checked={controls.video_messaging_enabled !== false}
                    onChange={(v) => setControls({ ...controls, video_messaging_enabled: v })}
                  />
                  <SettingsToggleRow
                    icon={Mic}
                    title="Audio messages"
                    description="Allow voice notes and audio clips"
                    checked={controls.audio_messaging_enabled !== false}
                    onChange={(v) => setControls({ ...controls, audio_messaging_enabled: v })}
                  />
                </div>
              ) : null}
              {areAllMessageTypesLocked(controls) ? (
                <SettingsToggleRow
                  icon={AlertTriangle}
                  title="Emergency messages"
                  description="When every message type is locked, allow emergency-only messages"
                  checked={controls.emergency_messaging_enabled !== false}
                  onChange={(v) => setControls({ ...controls, emergency_messaging_enabled: v })}
                />
              ) : null}
              <SettingsToggleRow
                icon={Phone}
                title="Calling"
                description="Master switch for calls. Turn off to block all call types."
                checked={controls.calling_enabled}
                onChange={(v) => setControls({ ...controls, calling_enabled: v })}
              />
              {controls.calling_enabled ? (
                <div className="space-y-0 border-l-2 border-primary/20 bg-surface-secondary/40">
                  <SettingsToggleRow
                    icon={Phone}
                    title="Audio calls"
                    description="Allow 1:1 voice calls"
                    checked={controls.audio_calling_enabled !== false}
                    onChange={(v) => setControls({ ...controls, audio_calling_enabled: v })}
                  />
                  <SettingsToggleRow
                    icon={Video}
                    title="Video calls"
                    description="Allow 1:1 video calls"
                    checked={controls.video_calling_enabled !== false}
                    onChange={(v) => setControls({ ...controls, video_calling_enabled: v })}
                  />
                  <SettingsToggleRow
                    icon={Users}
                    title="Group calls"
                    description="Allow starting or inviting people to group calls"
                    checked={controls.group_calling_enabled !== false}
                    onChange={(v) => setControls({ ...controls, group_calling_enabled: v })}
                  />
                </div>
              ) : null}
              <SettingsToggleRow
                icon={Users}
                title="Joining groups"
                description="Allow or block joining communities and groups"
                checked={controls.group_joining_enabled}
                onChange={(v) => setControls({ ...controls, group_joining_enabled: v })}
              />
              <SettingsToggleRow
                icon={ShoppingBag}
                title="Marketplace"
                description="Allow or block marketplace browsing and buying"
                checked={controls.marketplace_enabled}
                onChange={(v) => setControls({ ...controls, marketplace_enabled: v })}
              />
              <SettingsToggleRow
                icon={Award}
                title="Youth Leadership"
                description="Allow or block Youth Leadership programs, projects, and mentorship"
                checked={controls.youth_leadership_enabled !== false}
                onChange={(v) =>
                  setControls({ ...controls, youth_leadership_enabled: v })
                }
              />
              <SettingsToggleRow
                icon={Clock}
                title="Screen time"
                description="Enforce daily limits and school-hour / bedtime windows"
                checked={controls.screen_time_enabled}
                onChange={(v) => setControls({ ...controls, screen_time_enabled: v })}
              />
              <SettingsToggleRow
                icon={Film}
                title="Restrict Reels categories"
                description="Only show and allow creating reels in selected categories"
                checked={controls.reels_restriction_enabled === true}
                onChange={(v) =>
                  setControls({
                    ...controls,
                    reels_restriction_enabled: v,
                    reels_allowed_categories: v
                      ? controls.reels_allowed_categories?.length
                        ? controls.reels_allowed_categories
                        : REEL_CATEGORIES.map((c) => c.value)
                      : controls.reels_allowed_categories,
                  })
                }
              />
              {controls.reels_restriction_enabled ? (
                <div className="space-y-3 px-4 py-3 sm:px-5">
                  <p className={`${settingsLabelClass} mb-1`}>Allowed reel categories</p>
                  <div className="flex flex-wrap gap-2">
                    {REEL_CATEGORIES.map((cat) => {
                      const selected = (controls.reels_allowed_categories || []).includes(cat.value)
                      return (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() => {
                            const current = new Set(controls.reels_allowed_categories || [])
                            if (current.has(cat.value)) current.delete(cat.value)
                            else current.add(cat.value)
                            setControls({
                              ...controls,
                              reels_allowed_categories: Array.from(current),
                            })
                          }}
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                            selected
                              ? 'border-primary bg-primary text-white'
                              : 'border-border-subtle bg-surface text-content-secondary hover:border-primary/40'
                          }`}
                        >
                          {cat.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}
              <div className="space-y-3 px-4 py-3 sm:px-5">
                <div>
                  <label
                    className={`${settingsLabelClass} inline-flex items-center gap-2`}
                    htmlFor="profile-visibility"
                  >
                    <Eye className="h-4 w-4 text-content-secondary" aria-hidden />
                    Profile visibility
                  </label>
                  <select
                    id="profile-visibility"
                    className={settingsInputClass}
                    value={controls.profile_visibility ?? 'friends'}
                    onChange={(e) =>
                      setControls({
                        ...controls,
                        profile_visibility: e.target.value || null,
                      })
                    }
                  >
                    <option value="public">Public</option>
                    <option value="friends">Friends only</option>
                    <option value="private">Private</option>
                  </select>
                </div>
              </div>
              <div className="px-4 pt-3 sm:px-5">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveControls()}
                  className="inline-flex min-h-11 items-center gap-2 rounded-[14px] bg-primary px-4 text-sm font-semibold text-white disabled:opacity-60"
                >
                  <Shield className="h-4 w-4" aria-hidden />
                  Save permissions
                </button>
              </div>
            </div>
          ) : null}

          {memberView === 'screen-time' && screenTime ? (
            <div className="space-y-4 px-4 py-4 sm:px-5">
              <p className="text-sm text-content-secondary">
                Used today: {formatMinutes(usedMinutes)}
              </p>
              <ScreenTimeUsageChart
                history={screenTimeHistory}
                rangeDays={screenTimeRangeDays}
                dailyLimitMinutes={screenTime.daily_limit_minutes}
                loading={screenTimeHistoryLoading}
                onRangeChange={(days) => void changeScreenTimeRange(days)}
              />
              <SettingsToggleRow
                title="Enable screen-time rules"
                checked={screenTime.enabled}
                onChange={(v) => setScreenTime({ ...screenTime, enabled: v })}
              />
              <div>
                <label className={settingsLabelClass}>Daily limit (minutes)</label>
                <input
                  type="number"
                  min={0}
                  max={1440}
                  className={settingsInputClass}
                  value={screenTime.daily_limit_minutes ?? ''}
                  onChange={(e) =>
                    setScreenTime({
                      ...screenTime,
                      daily_limit_minutes: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
              <p className="text-sm text-content-secondary">
                Use the allowed window to lock the account during school hours. Bedtime covers sleep
                / family quiet time.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <TimeField
                  label="Allowed start (school / study window)"
                  value={screenTime.allowed_start_time}
                  onChange={(v) => setScreenTime({ ...screenTime, allowed_start_time: v })}
                />
                <TimeField
                  label="Allowed end"
                  value={screenTime.allowed_end_time}
                  onChange={(v) => setScreenTime({ ...screenTime, allowed_end_time: v })}
                />
                <TimeField
                  label="Bedtime start"
                  value={screenTime.bedtime_start}
                  onChange={(v) => setScreenTime({ ...screenTime, bedtime_start: v })}
                />
                <TimeField
                  label="Bedtime end"
                  value={screenTime.bedtime_end}
                  onChange={(v) => setScreenTime({ ...screenTime, bedtime_end: v })}
                />
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveScreenTime()}
                className="inline-flex min-h-11 items-center rounded-[14px] bg-primary px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                Save screen time
              </button>
            </div>
          ) : null}

          {memberView === 'activity' && activity ? (
            <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5">
              <Stat icon={Clock} label="Screen time" value={formatMinutes(activity.session_minutes)} />
              <Stat icon={UserPlus} label="Friends added" value={String(activity.friends_added)} />
              <Stat icon={Users} label="Communities joined" value={String(activity.groups_joined)} />
              <Stat
                icon={AlertTriangle}
                label="Safety alerts"
                value={String(activity.safety_alerts)}
              />
              <Stat
                icon={UserCheck}
                label="Friend requests"
                value={String(activity.friend_requests)}
              />
              <Stat
                icon={MessageSquare}
                label="Messages sent"
                value={String(activity.messages_sent)}
              />
              <Stat icon={Phone} label="Calls" value={String(activity.calls)} />
              <Stat icon={Eye} label="Posts viewed" value={String(activity.posts_viewed)} />
              <Stat icon={Activity} label="Reels watched" value={String(activity.reels_watched)} />
            </div>
          ) : null}

          {memberView === 'alerts' ? (
            <ul className="divide-y divide-border-subtle">
              {alerts.length === 0 ? (
                <li className="flex items-center gap-3 px-4 py-4 text-sm text-content-secondary sm:px-5">
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                  No safety alerts.
                </li>
              ) : (
                alerts.map((alert) => (
                  <li key={alert.id} className="px-4 py-3.5 sm:px-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-amber-500/10 text-amber-600">
                          <AlertTriangle className="h-[18px] w-[18px]" aria-hidden />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-content">{alert.title}</p>
                          <p className="mt-0.5 text-sm text-content-secondary">
                            {alert.severity} · {alert.alert_type} · {alert.status}
                          </p>
                          {alert.description ? (
                            <p className="mt-1 text-sm text-content-secondary">{alert.description}</p>
                          ) : null}
                        </div>
                      </div>
                      {alert.status === 'open' ? (
                        <button
                          type="button"
                          className="shrink-0 text-sm font-medium text-primary"
                          onClick={() =>
                            void familyService
                              .updateAlert(alert.id, 'acknowledged')
                              .then(() => openMember(selectedMember, 'alerts'))
                              .catch((err) =>
                                toast.error(err instanceof ApiError ? err.message : 'Update failed')
                              )
                          }
                        >
                          Acknowledge
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))
              )}
            </ul>
          ) : null}

          {memberView === 'friends' ? (
            <ul className="divide-y divide-border-subtle">
              {pendingFriends.length === 0 ? (
                <li className="flex items-center gap-3 px-4 py-4 text-sm text-content-secondary sm:px-5">
                  <UserPlus className="h-4 w-4 shrink-0" aria-hidden />
                  No pending friend requests.
                </li>
              ) : (
                pendingFriends.map((req) => {
                  const senderName =
                    req.sender?.full_name || req.sender?.username || 'Someone'
                  const senderInitials = senderName
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((p) => p[0])
                    .join('')
                    .toUpperCase()
                  return (
                    <li
                      key={req.id}
                      className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <MemberAvatar
                          avatarUrl={req.sender?.avatar_url}
                          name={senderName}
                          initials={senderInitials || '?'}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-content">{senderName}</p>
                          {req.sender?.username ? (
                            <p className="truncate text-xs text-content-secondary">
                              @{req.sender.username}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 rounded-[12px] bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                        onClick={() =>
                          void familyService
                            .approveFriendRequest(selectedMember.id, req.id)
                            .then(() => {
                              toast.success('Friend request approved')
                              return openMember(selectedMember, 'friends')
                            })
                            .catch((err) =>
                              toast.error(err instanceof ApiError ? err.message : 'Approve failed')
                            )
                        }
                      >
                        <UserCheck className="h-3.5 w-3.5" aria-hidden />
                        Approve
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          ) : null}
        </SettingsCard>
      </div>
    )
  }

  const managedMembers = (overview.members || []).filter(
    (m) => m.role === 'child' || m.role === 'teen'
  )

  return (
    <div className="space-y-4">
      <SettingsCard>
        <div className="flex items-start gap-3 border-b border-border-subtle px-4 py-4 sm:px-5">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-primary/10 text-primary">
            <Users className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold tracking-tight text-content">
              {overview.family.name}
            </h3>
            <p className="mt-0.5 text-sm leading-5 text-content-secondary">
              {isParent
                ? 'View account status, screen time, friends, communities, safety alerts, and permissions for connected child and teen accounts.'
                : 'You are part of this family.'}
            </p>
          </div>
        </div>
        <ul className="divide-y divide-border-subtle">
          {(overview.members || []).map((member) => {
            const isYou = member.user_id === overview.membership?.user_id
            const displayName = isYou ? 'You' : memberLabel(member)
            return (
              <li key={member.id} className="px-4 py-4 sm:px-5">
                <div className="flex flex-col gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <MemberAvatar
                      avatarUrl={
                        isYou
                          ? profile?.avatar_url || member.profile?.avatar_url
                          : member.profile?.avatar_url
                      }
                      name={displayName}
                      initials={memberInitials(member)}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[15px] font-semibold text-content">{displayName}</p>
                        <RoleBadge role={member.role} />
                        {isYou ? (
                          <span className="inline-flex items-center rounded-full bg-surface-secondary px-2 py-0.5 text-[11px] font-medium text-content-secondary">
                            You
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-content-secondary">
                        {member.profile?.username ? `@${member.profile.username}` : null}
                        {member.profile?.username ? ' · ' : null}
                        Account {member.status}
                      </p>
                    </div>
                  </div>
                  {isParent && (member.role === 'child' || member.role === 'teen') ? (
                    <div className="flex flex-wrap gap-2 pl-0 sm:pl-14">
                      <ActionChip
                        icon={Shield}
                        label="Permissions"
                        onClick={() => void openMember(member, 'controls')}
                      />
                      <ActionChip
                        icon={Clock}
                        label="Screen time"
                        onClick={() => void openMember(member, 'screen-time')}
                      />
                      <ActionChip
                        icon={Activity}
                        label="Activity"
                        onClick={() => void openMember(member, 'activity')}
                      />
                      <ActionChip
                        icon={AlertTriangle}
                        label="Alerts"
                        onClick={() => void openMember(member, 'alerts')}
                      />
                      <ActionChip
                        icon={UserPlus}
                        label="Friends"
                        onClick={() => void openMember(member, 'friends')}
                      />
                      <ActionChip
                        icon={Trash2}
                        label="Remove"
                        danger
                        onClick={() => void removeMember(member)}
                      />
                    </div>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      </SettingsCard>

      {isParent ? (
        <SettingsCard>
          <div className="flex items-start gap-3 border-b border-border-subtle px-4 py-4 sm:px-5">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-primary/10 text-primary">
              <UserPlus className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold tracking-tight text-content">
                Invite a member
              </h3>
              <p className="mt-0.5 text-sm leading-5 text-content-secondary">
                Invite a CribsTalk user by email. This is separate from friend requests.
              </p>
            </div>
          </div>
          <div className="space-y-3 px-4 py-4 sm:px-5">
            <div>
              <label
                className={`${settingsLabelClass} inline-flex items-center gap-2`}
                htmlFor="invite-email"
              >
                <Mail className="h-4 w-4 text-content-secondary" aria-hidden />
                Email
              </label>
              <input
                id="invite-email"
                type="email"
                autoComplete="email"
                className={settingsInputClass}
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="member@example.com"
              />
            </div>
            <div>
              <label
                className={`${settingsLabelClass} inline-flex items-center gap-2`}
                htmlFor="invite-role"
              >
                <User className="h-4 w-4 text-content-secondary" aria-hidden />
                Role
              </label>
              <select
                id="invite-role"
                className={settingsInputClass}
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as FamilyMemberRole)}
              >
                <option value="child">Child</option>
                <option value="teen">Teen</option>
                <option value="parent">Parent</option>
              </select>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => void sendInvite()}
              className="inline-flex min-h-11 items-center gap-2 rounded-[14px] bg-primary px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              <UserPlus className="h-4 w-4" aria-hidden />
              Send invitation
            </button>
            {managedMembers.length === 0 ? (
              <p className="text-sm text-content-secondary">
                No child or teen members yet. Invite someone to get started.
              </p>
            ) : null}
          </div>
        </SettingsCard>
      ) : null}

      {isParent ? (
        <SettingsCard>
          <div className="flex items-start gap-3 border-b border-border-subtle px-4 py-4 sm:px-5">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-amber-500/10 text-amber-600">
              <AlertTriangle className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold tracking-tight text-content">
                Safety alerts
              </h3>
              <p className="mt-0.5 text-sm leading-5 text-content-secondary">
                Signals for review — not automatic accusations.
              </p>
            </div>
          </div>
          <div className="px-4 py-4 sm:px-5">
            <button
              type="button"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary"
              onClick={() =>
                void familyService
                  .listAlerts()
                  .then((rows) => {
                    setAlerts(rows)
                    setSelectedMember(managedMembers[0] || overview.membership || null)
                    setMemberView('alerts')
                  })
                  .catch((err) =>
                    toast.error(err instanceof ApiError ? err.message : 'Failed to load alerts')
                  )
              }
            >
              <AlertTriangle className="h-4 w-4" aria-hidden />
              View all family alerts
            </button>
          </div>
        </SettingsCard>
      ) : null}
    </div>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: SettingsIcon
  label: string
  value: string
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3.5 sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-surface-secondary text-content-secondary">
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </div>
        <p className="text-sm font-medium text-content">{label}</p>
      </div>
      <p className="text-sm text-content-secondary text-right">{value}</p>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: SettingsIcon
  label: string
  value: string
}) {
  return (
    <div className="rounded-[14px] border border-border-subtle px-3 py-3">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] bg-surface-secondary text-content-secondary">
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </div>
        <p className="text-xs text-content-secondary">{label}</p>
      </div>
      <p className="mt-2 text-[15px] font-semibold text-content">{value}</p>
    </div>
  )
}

function ActionChip({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: SettingsIcon
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-[10px] border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-surface-secondary ${
        danger
          ? 'border-danger/30 text-danger hover:bg-danger/5'
          : 'border-border text-content'
      }`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  )
}

function TimeField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string | null
  onChange: (v: string | null) => void
}) {
  return (
    <div>
      <label className={settingsLabelClass}>{label}</label>
      <input
        type="time"
        className={settingsInputClass}
        value={value ? String(value).slice(0, 5) : ''}
        onChange={(e) => onChange(e.target.value ? `${e.target.value}:00` : null)}
      />
    </div>
  )
}
