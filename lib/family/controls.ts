import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DEFAULT_PARENTAL_CONTROLS,
  getAllowedReelCategories,
  isCallKindAllowed,
  isMessageKindAllowed,
  type ParentalCallKind,
  type ParentalControls,
  type ParentalRestrictionFeature,
} from '@/shared/types/family'
import { getActiveMembership, isManagedRole } from './auth'
import { evaluateScreenTime, type ScreenTimeEvaluation } from './screenTime'
import type { ParentalMessageKind } from './messageKinds'

export type ParentalDecision = {
  allowed: boolean
  code?: 'PARENTAL_RESTRICTED'
  message?: string
  feature?: ParentalRestrictionFeature
  screenTime?: ScreenTimeEvaluation
}

export type ParentalRestrictionOptions = {
  now?: Date
  messageKind?: ParentalMessageKind
  callKind?: ParentalCallKind
  reelCategory?: string | null
}

function deny(
  feature: ParentalRestrictionFeature,
  message: string
): ParentalDecision {
  return {
    allowed: false,
    code: 'PARENTAL_RESTRICTED',
    message,
    feature,
  }
}

/** Non-managed users are unrestricted; only active child/teen members are gated. */
export async function getEffectiveControls(
  supabase: SupabaseClient,
  userId: string
): Promise<{
  membership: Awaited<ReturnType<typeof getActiveMembership>>
  controls: ParentalControls | null
} | null> {
  const membership = await getActiveMembership(supabase, userId)
  if (!membership || !isManagedRole(membership.role) || membership.status !== 'active') {
    return null
  }

  const { data: controls } = await supabase
    .from('parental_controls')
    .select('*')
    .eq('family_member_id', membership.id)
    .maybeSingle()

  return {
    membership,
    controls: normalizeControls(controls as ParentalControls | null),
  }
}

/** Fill missing granular columns for rows created before the migration. */
export function normalizeControls(
  controls: ParentalControls | null | undefined
): ParentalControls | null {
  if (!controls) return null
  return {
    ...DEFAULT_PARENTAL_CONTROLS,
    ...controls,
    text_messaging_enabled: controls.text_messaging_enabled ?? true,
    image_messaging_enabled: controls.image_messaging_enabled ?? true,
    video_messaging_enabled: controls.video_messaging_enabled ?? true,
    audio_messaging_enabled: controls.audio_messaging_enabled ?? true,
    emergency_messaging_enabled: controls.emergency_messaging_enabled ?? true,
    audio_calling_enabled: controls.audio_calling_enabled ?? true,
    video_calling_enabled: controls.video_calling_enabled ?? true,
    group_calling_enabled: controls.group_calling_enabled ?? true,
    reels_restriction_enabled: controls.reels_restriction_enabled ?? false,
    reels_allowed_categories: Array.isArray(controls.reels_allowed_categories)
      ? controls.reels_allowed_categories
      : null,
  }
}

export async function ensureDefaultControls(
  supabase: SupabaseClient,
  familyMemberId: string
): Promise<ParentalControls> {
  const { data: existing } = await supabase
    .from('parental_controls')
    .select('*')
    .eq('family_member_id', familyMemberId)
    .maybeSingle()

  if (existing) return normalizeControls(existing as ParentalControls)!

  const { data, error } = await supabase
    .from('parental_controls')
    .insert({
      family_member_id: familyMemberId,
      ...DEFAULT_PARENTAL_CONTROLS,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return normalizeControls(data as ParentalControls)!
}

export async function checkParentalRestriction(
  supabase: SupabaseClient,
  userId: string,
  feature: ParentalRestrictionFeature,
  options?: ParentalRestrictionOptions
): Promise<ParentalDecision> {
  const effective = await getEffectiveControls(supabase, userId)
  if (!effective) {
    return { allowed: true }
  }

  const controls = effective.controls
  if (!controls) {
    return { allowed: true }
  }

  if (feature === 'messaging') {
    const kind = options?.messageKind || 'text'
    if (!isMessageKindAllowed(controls, kind)) {
      if (kind === 'emergency') {
        return deny(
          'messaging',
          'Emergency messaging is not available under your current family settings.'
        )
      }
      const label =
        kind === 'image'
          ? 'Image messages'
          : kind === 'video'
            ? 'Video messages'
            : kind === 'audio'
              ? 'Audio messages'
              : 'Messaging'
      return deny('messaging', `${label} are restricted by your parent.`)
    }
    return { allowed: true }
  }

  if (feature === 'calling') {
    const kind = options?.callKind || 'audio'
    if (!isCallKindAllowed(controls, kind)) {
      const label =
        kind === 'group_video'
          ? 'Group video calls'
          : kind === 'group_audio'
            ? 'Group audio calls'
            : kind === 'video'
              ? 'Video calls'
              : 'Audio calls'
      return deny('calling', `${label} are restricted by your parent.`)
    }
    return { allowed: true }
  }

  if (feature === 'group_joining' && controls.group_joining_enabled === false) {
    return deny('group_joining', 'Joining groups is restricted by your parent.')
  }

  if (feature === 'marketplace' && controls.marketplace_enabled === false) {
    return deny('marketplace', 'Marketplace is restricted by your parent.')
  }

  if (feature === 'friend_request_accept' && controls.friend_request_approval === true) {
    return deny('friend_request_accept', 'Friend requests require parent approval.')
  }

  if (feature === 'reels') {
    const allowed = getAllowedReelCategories(controls)
    if (allowed === null) return { allowed: true }
    if (allowed.length === 0) {
      return deny('reels', 'Reels are restricted by your parent.')
    }
    const category = (options?.reelCategory || '').trim().toLowerCase()
    if (category && !allowed.map((c) => c.toLowerCase()).includes(category)) {
      return deny(
        'reels',
        'This reel category is not allowed under your family settings.'
      )
    }
    return { allowed: true }
  }

  if (feature === 'screen_time' && controls.screen_time_enabled) {
    const { data: rules } = await supabase
      .from('screen_time_rules')
      .select('*')
      .eq('family_member_id', effective.membership!.id)
      .maybeSingle()

    if (rules?.enabled) {
      const { sumSessionMinutesToday } = await import('./activity')
      const usedMinutes = await sumSessionMinutesToday(
        supabase,
        effective.membership!.id,
        options?.now
      )
      const evaluation = evaluateScreenTime(rules, usedMinutes, options?.now)
      if (!evaluation.allowed) {
        return {
          allowed: false,
          code: 'PARENTAL_RESTRICTED',
          message: evaluation.message || 'Screen time limit reached.',
          feature: 'screen_time',
          screenTime: evaluation,
        }
      }
    }
  }

  return { allowed: true }
}

export async function requiresParentFriendApproval(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const decision = await checkParentalRestriction(supabase, userId, 'friend_request_accept')
  return !decision.allowed
}

/** Resolve allowed reel categories for a managed child, or null if unrestricted. */
export async function getReelsCategoryFilterForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<string[] | null> {
  const effective = await getEffectiveControls(supabase, userId)
  if (!effective?.controls) return null
  return getAllowedReelCategories(effective.controls)
}
