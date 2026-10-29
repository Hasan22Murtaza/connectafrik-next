import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DEFAULT_PARENTAL_CONTROLS,
  type ParentalControls,
  type ParentalRestrictionFeature,
} from '@/shared/types/family'
import { getActiveMembership, isManagedRole } from './auth'
import { evaluateScreenTime, type ScreenTimeEvaluation } from './screenTime'

export type ParentalDecision = {
  allowed: boolean
  code?: 'PARENTAL_RESTRICTED'
  message?: string
  feature?: ParentalRestrictionFeature
  screenTime?: ScreenTimeEvaluation
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
    controls: (controls as ParentalControls | null) ?? null,
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

  if (existing) return existing as ParentalControls

  const { data, error } = await supabase
    .from('parental_controls')
    .insert({
      family_member_id: familyMemberId,
      ...DEFAULT_PARENTAL_CONTROLS,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data as ParentalControls
}

export async function checkParentalRestriction(
  supabase: SupabaseClient,
  userId: string,
  feature: ParentalRestrictionFeature,
  options?: { now?: Date }
): Promise<ParentalDecision> {
  const effective = await getEffectiveControls(supabase, userId)
  if (!effective) {
    return { allowed: true }
  }

  const controls = effective.controls
  if (!controls) {
    return { allowed: true }
  }

  if (feature === 'messaging' && controls.messaging_enabled === false) {
    return {
      allowed: false,
      code: 'PARENTAL_RESTRICTED',
      message: 'Messaging is restricted by your parent.',
      feature,
    }
  }

  if (feature === 'calling' && controls.calling_enabled === false) {
    return {
      allowed: false,
      code: 'PARENTAL_RESTRICTED',
      message: 'Calling is restricted by your parent.',
      feature,
    }
  }

  if (feature === 'group_joining' && controls.group_joining_enabled === false) {
    return {
      allowed: false,
      code: 'PARENTAL_RESTRICTED',
      message: 'Joining groups is restricted by your parent.',
      feature,
    }
  }

  if (feature === 'marketplace' && controls.marketplace_enabled === false) {
    return {
      allowed: false,
      code: 'PARENTAL_RESTRICTED',
      message: 'Marketplace is restricted by your parent.',
      feature,
    }
  }

  if (feature === 'friend_request_accept' && controls.friend_request_approval === true) {
    return {
      allowed: false,
      code: 'PARENTAL_RESTRICTED',
      message: 'Friend requests require parent approval.',
      feature,
    }
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
