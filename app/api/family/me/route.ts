import { NextRequest } from 'next/server'
import { createServiceClient, getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { createNotification } from '@/lib/notifications/createNotification'
import {
  ensureDefaultControls,
  evaluateScreenTime,
  getActiveMembership,
  isChildOrTeenRole,
  isParentalControlsActive,
  processAgeMilestoneForMember,
  recordActivityEvent,
  sumSessionMinutesToday,
  getEffectiveControls,
} from '@/lib/family'

/** Child/teen view of active controls + optional usage ping. */
export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    let membership = await getActiveMembership(supabase, user.id)

    if (!membership) {
      return jsonResponse({
        has_family: false,
        role: null,
        controls_active: false,
        controls: null,
        screen_time: null,
      })
    }

    // Age milestones for Child accounts (16 notice / 18 auto Teen).
    if (membership.role === 'child') {
      const service = createServiceClient()
      const { data: profile } = await service
        .from('profiles')
        .select('birthday')
        .eq('id', user.id)
        .maybeSingle()

      await processAgeMilestoneForMember(service, membership, profile?.birthday)
      membership = (await getActiveMembership(supabase, user.id)) || membership
    }

    if (!isChildOrTeenRole(membership.role)) {
      return jsonResponse({
        has_family: true,
        role: membership.role,
        controls_active: false,
        parental_oversight_enabled: false,
        membership,
        controls: null,
        screen_time: null,
      })
    }

    const controlsActive = isParentalControlsActive(membership)
    const effective = controlsActive ? await getEffectiveControls(supabase, user.id) : null
    const { data: rules } = controlsActive
      ? await supabase
          .from('screen_time_rules')
          .select('*')
          .eq('family_member_id', membership.id)
          .maybeSingle()
      : { data: null }

    const usedMinutes = controlsActive
      ? await sumSessionMinutesToday(supabase, membership.id)
      : 0
    const evaluation = evaluateScreenTime(rules, usedMinutes)

    return jsonResponse({
      has_family: true,
      role: membership.role,
      controls_active: controlsActive,
      parental_oversight_enabled: Boolean(membership.parental_oversight_enabled),
      membership,
      controls: effective?.controls ?? null,
      screen_time: rules
        ? { rules, used_minutes_today: usedMinutes, evaluation }
        : null,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load family status'
    if (message === 'Unauthorized' || message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(message, 500)
  }
}

/**
 * Teen opt-in/out for parental oversight, or session ping for managed members.
 */
export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json().catch(() => ({}))
    const action = body?.action || 'session_ping'

    if (action === 'set_parental_oversight') {
      const enabled = body?.enabled === true
      const membership = await getActiveMembership(supabase, user.id)
      if (!membership || membership.role !== 'teen') {
        return errorResponse('Only teens can change parental oversight settings', 403)
      }

      // Service role: teens may update their own membership, but parental_controls /
      // screen_time_rules inserts are parent-only under RLS.
      const service = createServiceClient()
      const { data, error } = await service
        .from('family_members')
        .update({ parental_oversight_enabled: enabled })
        .eq('id', membership.id)
        .eq('user_id', user.id)
        .eq('role', 'teen')
        .select('*')
        .maybeSingle()

      if (error) return errorResponse(error.message, 400)
      if (!data) return errorResponse('Could not update parental oversight', 400)

      if (enabled) {
        await ensureDefaultControls(service, membership.id)
        await service.from('screen_time_rules').upsert(
          { family_member_id: membership.id, enabled: false },
          { onConflict: 'family_member_id' }
        )
      }

      return jsonResponse({
        membership: data,
        parental_oversight_enabled: enabled,
      })
    }

    if (action !== 'session_ping') {
      return errorResponse('Unsupported action', 400)
    }

    const membership = await getActiveMembership(supabase, user.id)
    if (!membership || !isParentalControlsActive(membership)) {
      return jsonResponse({ recorded: false })
    }

    await recordActivityEvent(supabase, user.id, 'session_ping', 1)

    const { data: rules } = await supabase
      .from('screen_time_rules')
      .select('*')
      .eq('family_member_id', membership.id)
      .maybeSingle()

    if (rules?.enabled) {
      const usedMinutes = await sumSessionMinutesToday(supabase, membership.id)
      const evaluation = evaluateScreenTime(rules, usedMinutes)
      if (!evaluation.allowed && evaluation.reason === 'daily_limit') {
        const dayStart = new Date()
        dayStart.setUTCHours(0, 0, 0, 0)
        const { data: existingExcessAlert } = await supabase
          .from('safety_alerts')
          .select('id')
          .eq('family_member_id', membership.id)
          .eq('alert_type', 'excessive_usage')
          .gte('created_at', dayStart.toISOString())
          .limit(1)
          .maybeSingle()

        if (!existingExcessAlert) {
          const { createSafetyAlertForUser } = await import('@/lib/family/alerts')
          await createSafetyAlertForUser(createServiceClient(), {
            userId: user.id,
            alertType: 'excessive_usage',
            severity: 'info',
            title: 'Excessive daily usage',
            description: 'This account reached its daily CribsTalk screen-time limit.',
            source: 'screen_time',
          })

          try {
            await createNotification({
              user_id: user.id,
              type: 'family_screen_time_limit',
              title: 'Screen-time limit reached',
              message: 'You have reached your daily CribsTalk screen-time limit.',
              data: {
                type: 'family_screen_time_limit',
                family_member_id: membership.id,
                url: '/family-circle',
              },
            })
          } catch {
            // non-fatal
          }
        }
      }

      return jsonResponse({
        recorded: true,
        evaluation,
        used_minutes_today: usedMinutes,
      })
    }

    return jsonResponse({ recorded: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to record usage'
    if (message === 'Unauthorized' || message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(message, 500)
  }
}
