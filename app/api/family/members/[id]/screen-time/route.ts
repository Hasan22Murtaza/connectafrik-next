import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { createNotification } from '@/lib/notifications/createNotification'
import {
  FamilyAuthError,
  evaluateScreenTime,
  getActiveMembership,
  isManagedRole,
  requireParentOfMember,
  sumSessionMinutesToday,
} from '@/lib/family'

async function ensureScreenTimeRules(
  supabase: Awaited<ReturnType<typeof getAuthenticatedUser>>['supabase'],
  familyMemberId: string
) {
  const { data: existing } = await supabase
    .from('screen_time_rules')
    .select('*')
    .eq('family_member_id', familyMemberId)
    .maybeSingle()

  if (existing) return existing

  const { data, error } = await supabase
    .from('screen_time_rules')
    .insert({ family_member_id: familyMemberId, enabled: false })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)

    const membership = await getActiveMembership(supabase, user.id)
    const { data: target } = await supabase
      .from('family_members')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (!target) return errorResponse('Member not found', 404)

    const isSelf = target.user_id === user.id
    const isParent =
      membership?.role === 'parent' &&
      membership.status === 'active' &&
      membership.family_id === target.family_id

    if (!isSelf && !isParent) {
      return errorResponse('Forbidden', 403)
    }

    if (!isManagedRole(target.role)) {
      return jsonResponse(null)
    }

    const rules = await ensureScreenTimeRules(supabase, id)
    const usedMinutes = await sumSessionMinutesToday(supabase, id)
    const evaluation = evaluateScreenTime(rules, usedMinutes)

    return jsonResponse({ rules, used_minutes_today: usedMinutes, evaluation })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load screen time'
    if (message === 'Unauthorized' || message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(message, 500)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)
    const { target } = await requireParentOfMember(supabase, user.id, id)

    if (!isManagedRole(target.role)) {
      return errorResponse('Screen time only applies to child or teen members', 400)
    }

    await ensureScreenTimeRules(supabase, id)
    const body = await request.json().catch(() => ({}))
    const updates: Record<string, unknown> = {}

    if (typeof body?.enabled === 'boolean') updates.enabled = body.enabled

    if (body?.daily_limit_minutes === null) {
      updates.daily_limit_minutes = null
    } else if (typeof body?.daily_limit_minutes === 'number') {
      const n = Math.floor(body.daily_limit_minutes)
      if (n < 0 || n > 1440) {
        return errorResponse('daily_limit_minutes must be between 0 and 1440', 400)
      }
      updates.daily_limit_minutes = n
    }

    for (const key of [
      'allowed_start_time',
      'allowed_end_time',
      'bedtime_start',
      'bedtime_end',
    ] as const) {
      if (body?.[key] === null || typeof body?.[key] === 'string') {
        updates[key] = body[key]
      }
    }

    if (body?.per_day_config === null || typeof body?.per_day_config === 'object') {
      updates.per_day_config = body.per_day_config
    }

    if (Object.keys(updates).length === 0) {
      return errorResponse('No valid fields to update', 400)
    }

    const { data, error } = await supabase
      .from('screen_time_rules')
      .update(updates)
      .eq('family_member_id', id)
      .select('*')
      .single()

    if (error) return errorResponse(error.message, 400)

    // Keep the parental-controls master switch aligned with rule enablement so
    // the child gate + API enforcement activate when rules are turned on.
    if (typeof updates.enabled === 'boolean') {
      await supabase
        .from('parental_controls')
        .update({ screen_time_enabled: updates.enabled === true })
        .eq('family_member_id', id)
    }

    try {
      await createNotification({
        user_id: target.user_id,
        type: 'family_screen_time_updated',
        title: 'Screen time updated',
        message: 'Your parent changed your screen-time settings.',
        data: {
          type: 'family_screen_time_updated',
          family_member_id: id,
          url: '/settings?tab=family',
        },
      })
    } catch (err) {
      console.error('Failed to notify child of screen time update:', err)
    }

    return jsonResponse(data)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update screen time'
    if (message === 'Unauthorized' || message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    if (error instanceof FamilyAuthError) {
      return errorResponse(error.message, error.status)
    }
    return errorResponse(message, 500)
  }
}
