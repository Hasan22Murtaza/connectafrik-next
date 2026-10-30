'use client'

import React, { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { AlertTriangle, Clock, Shield, Users, UserPlus } from '@/shared/icons'
import {
  SettingsCard,
  SettingsSectionHeader,
  SettingsToggleRow,
  settingsInputClass,
  settingsLabelClass,
} from './SettingsPrimitives'
import { familyService, type FamilyMeStatus, type FamilyOverview } from '../services/familyService'
import type {
  ActivitySummary,
  FamilyInvitation,
  FamilyMember,
  FamilyMemberRole,
  ParentalControls,
  SafetyAlert,
  ScreenTimeDailyHistory,
  ScreenTimeRules,
} from '@/shared/types/family'
import { ApiError } from '@/lib/api-client'
import { useProfile } from '@/shared/hooks/useProfile'
import { isAdultForFamily } from '@/lib/family/age'
import { isManagedRole } from '@/lib/family/auth'
import { ScreenTimeUsageChart } from '@/features/family/components/ScreenTimeUsageChart'

type MemberView = 'list' | 'controls' | 'screen-time' | 'activity' | 'alerts' | 'friends'

function formatMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h <= 0) return `${m}m`
  return `${h}h ${m}m`
}

function memberLabel(m: FamilyMember) {
  return m.profile?.full_name || m.profile?.username || 'Member'
}

function roleLabel(role: string) {
  if (role === 'parent') return 'Parent'
  if (role === 'teen') return 'Teen'
  return 'Child'
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
      sender: { full_name: string | null; username: string | null } | null
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
        setControls(await familyService.getControls(member.id))
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
          <SettingsSectionHeader
            title="Family Controls"
            description="Your parent manages some settings for your CribsTalk account."
          />
          <div className="divide-y divide-border-subtle">
            <InfoRow
              label="Friend requests"
              value={
                me.controls?.friend_request_approval
                  ? 'Parent approval required'
                  : 'Allowed'
              }
            />
            <InfoRow
              label="Messaging"
              value={me.controls?.messaging_enabled === false ? 'Restricted' : 'Allowed'}
            />
            <InfoRow
              label="Calls"
              value={me.controls?.calling_enabled === false ? 'Restricted' : 'Allowed'}
            />
            <InfoRow
              label="Groups"
              value={me.controls?.group_joining_enabled === false ? 'Restricted' : 'Allowed'}
            />
            <InfoRow
              label="Marketplace"
              value={me.controls?.marketplace_enabled === false ? 'Restricted' : 'Allowed'}
            />
            <InfoRow
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
                <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
                  <div>
                    <p className="text-sm font-medium text-content">
                      Join as {roleLabel(inv.role)}
                    </p>
                    <p className="text-sm text-content-secondary">
                      Expires {new Date(inv.expires_at).toLocaleDateString()}
                    </p>
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
            <SettingsSectionHeader
              title="Create a family"
              description="Set up Family & Parental Controls for child and teen accounts. Existing CribsTalk features stay the same until someone joins."
            />
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
                className="inline-flex min-h-11 items-center justify-center rounded-[14px] bg-primary px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                Create family
              </button>
            </div>
          </SettingsCard>
        ) : (
          <SettingsCard>
            <SettingsSectionHeader
              title="Join a family"
              description="Only adults (18+) can create a family. Ask a parent to invite you by email — invitations appear above when you receive one."
            />
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
          <SettingsSectionHeader
            title={`${memberLabel(selectedMember)} · ${roleLabel(selectedMember.role)}`}
            description={
              memberView === 'controls'
                ? 'Permissions for this account'
                : memberView === 'screen-time'
                  ? 'CribsTalk usage limits'
                  : memberView === 'activity'
                    ? 'Activity summary (counts only — no private messages)'
                    : memberView === 'friends'
                      ? 'Friend requests waiting for your approval'
                      : 'Safety alerts for review'
            }
          />

          {memberView === 'controls' && controls ? (
            <div className="divide-y divide-border-subtle pb-4">
              <SettingsToggleRow
                icon={Shield}
                title="Friend request approval"
                description="Require your approval before they accept friends"
                checked={controls.friend_request_approval}
                onChange={(v) => setControls({ ...controls, friend_request_approval: v })}
              />
              <SettingsToggleRow
                title="Messaging"
                checked={controls.messaging_enabled}
                onChange={(v) => setControls({ ...controls, messaging_enabled: v })}
              />
              <SettingsToggleRow
                title="Calling"
                checked={controls.calling_enabled}
                onChange={(v) => setControls({ ...controls, calling_enabled: v })}
              />
              <SettingsToggleRow
                title="Joining groups"
                checked={controls.group_joining_enabled}
                onChange={(v) => setControls({ ...controls, group_joining_enabled: v })}
              />
              <SettingsToggleRow
                title="Marketplace"
                checked={controls.marketplace_enabled}
                onChange={(v) => setControls({ ...controls, marketplace_enabled: v })}
              />
              <SettingsToggleRow
                icon={Clock}
                title="Screen time"
                description="Enforce CribsTalk usage limits"
                checked={controls.screen_time_enabled}
                onChange={(v) => setControls({ ...controls, screen_time_enabled: v })}
              />
              <div className="px-4 pt-3 sm:px-5">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveControls()}
                  className="inline-flex min-h-11 items-center rounded-[14px] bg-primary px-4 text-sm font-semibold text-white disabled:opacity-60"
                >
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
              <div className="grid gap-3 sm:grid-cols-2">
                <TimeField
                  label="Allowed start"
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
              <Stat label="Time spent" value={formatMinutes(activity.session_minutes)} />
              <Stat label="Messages sent" value={String(activity.messages_sent)} />
              <Stat label="Calls" value={String(activity.calls)} />
              <Stat label="Posts viewed" value={String(activity.posts_viewed)} />
              <Stat label="Reels watched" value={String(activity.reels_watched)} />
              <Stat label="Friends added" value={String(activity.friends_added)} />
              <Stat label="Friend requests" value={String(activity.friend_requests)} />
              <Stat label="Groups joined" value={String(activity.groups_joined)} />
              <Stat label="Safety alerts" value={String(activity.safety_alerts)} />
            </div>
          ) : null}

          {memberView === 'alerts' ? (
            <ul className="divide-y divide-border-subtle">
              {alerts.length === 0 ? (
                <li className="px-4 py-4 text-sm text-content-secondary sm:px-5">
                  No safety alerts.
                </li>
              ) : (
                alerts.map((alert) => (
                  <li key={alert.id} className="px-4 py-3.5 sm:px-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-content">{alert.title}</p>
                        <p className="mt-0.5 text-sm text-content-secondary">
                          {alert.severity} · {alert.alert_type} · {alert.status}
                        </p>
                        {alert.description ? (
                          <p className="mt-1 text-sm text-content-secondary">{alert.description}</p>
                        ) : null}
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
                <li className="px-4 py-4 text-sm text-content-secondary sm:px-5">
                  No pending friend requests.
                </li>
              ) : (
                pendingFriends.map((req) => (
                  <li
                    key={req.id}
                    className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5"
                  >
                    <p className="text-sm text-content">
                      {req.sender?.full_name || req.sender?.username || 'Someone'}
                    </p>
                    <button
                      type="button"
                      disabled={saving}
                      className="rounded-[12px] bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
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
                      Approve
                    </button>
                  </li>
                ))
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
        <SettingsSectionHeader
          title={overview.family.name}
          description={
            isParent
              ? 'Manage connected child and teen accounts.'
              : 'You are part of this family.'
          }
        />
        <ul className="divide-y divide-border-subtle">
          {(overview.members || []).map((member) => {
            const isYou = member.user_id === overview.membership?.user_id
            return (
              <li key={member.id} className="px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-surface-secondary text-content-secondary">
                      <Users className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-content">
                        {isYou ? 'You' : memberLabel(member)}
                      </p>
                      <p className="text-sm text-content-secondary">{roleLabel(member.role)}</p>
                    </div>
                  </div>
                  {isParent && (member.role === 'child' || member.role === 'teen') ? (
                    <div className="flex flex-wrap gap-2">
                      <ActionChip label="Permissions" onClick={() => void openMember(member, 'controls')} />
                      <ActionChip label="Screen time" onClick={() => void openMember(member, 'screen-time')} />
                      <ActionChip label="Activity" onClick={() => void openMember(member, 'activity')} />
                      <ActionChip label="Alerts" onClick={() => void openMember(member, 'alerts')} />
                      <ActionChip label="Friends" onClick={() => void openMember(member, 'friends')} />
                      <ActionChip label="Remove" onClick={() => void removeMember(member)} />
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
          <SettingsSectionHeader
            title="Invite a member"
            description="Invite a CribsTalk user by email. This is separate from friend requests."
          />
          <div className="space-y-3 px-4 py-4 sm:px-5">
            <div>
              <label className={settingsLabelClass} htmlFor="invite-email">
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
              <label className={settingsLabelClass} htmlFor="invite-role">
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
          <SettingsSectionHeader
            title="Safety alerts"
            description="Signals for review — not automatic accusations."
          />
          <div className="px-4 py-4 sm:px-5">
            <button
              type="button"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary"
              onClick={() =>
                void familyService
                  .listAlerts()
                  .then((rows) => {
                    setAlerts(rows)
                    setSelectedMember(
                      managedMembers[0] || overview.membership || null
                    )
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3.5 sm:px-5">
      <p className="text-sm font-medium text-content">{label}</p>
      <p className="text-sm text-content-secondary text-right">{value}</p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-border-subtle px-3 py-3">
      <p className="text-xs text-content-secondary">{label}</p>
      <p className="mt-1 text-[15px] font-semibold text-content">{value}</p>
    </div>
  )
}

function ActionChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[10px] border border-border px-2.5 py-1.5 text-xs font-medium text-content hover:bg-surface-secondary"
    >
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
