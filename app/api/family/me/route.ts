import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { createNotification } from '@/lib/notifications/createNotification'
import {
  evaluateScreenTime,
  getActiveMembership,
  getEffectiveControls,
  isManagedRole,
  recordActivityEvent,
  sumSessionMinutesToday,
} from '@/lib/family'

/** Child/teen view of active controls + optional usage ping. */
export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const membership = await getActiveMembership(supabase, user.id)

    if (!membership) {
      return jsonResponse({
        has_family: false,
        role: null,
        controls_active: false,
        controls: null,
        screen_time: null,
      })
    }

    if (!isManagedRole(membership.role)) {
      return jsonResponse({
        has_family: true,
        role: membership.role,
        controls_active: false,
        membership,
        controls: null,
        screen_time: null,
      })
    }

    const effective = await getEffectiveControls(supabase, user.id)
    const { data: rules } = await supabase
      .from('screen_time_rules')
      .select('*')
      .eq('family_member_id', membership.id)
      .maybeSingle()

    const usedMinutes = await sumSessionMinutesToday(supabase, membership.id)
    const evaluation = evaluateScreenTime(rules, usedMinutes)

    return jsonResponse({
      has_family: true,
      role: membership.role,
      controls_active: true,
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

/** Record a 1-minute session ping for CribsTalk usage (managed members only). */
export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json().catch(() => ({}))
    const action = body?.action || 'session_ping'

    if (action !== 'session_ping') {
      return errorResponse('Unsupported action', 400)
    }

    const membership = await getActiveMembership(supabase, user.id)
    if (!membership || !isManagedRole(membership.role)) {
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
        const { data: parents } = await supabase
          .from('family_members')
          .select('user_id')
          .eq('family_id', membership.family_id)
          .eq('role', 'parent')
          .eq('status', 'active')

        for (const parent of parents || []) {
          try {
            await createNotification({
              user_id: parent.user_id,
              type: 'family_screen_time_limit',
              title: 'Screen-time limit reached',
              message: 'A family member reached their daily CribsTalk limit.',
              data: {
                type: 'family_screen_time_limit',
                family_member_id: membership.id,
                url: '/settings?tab=family',
              },
            })
          } catch {
            // non-fatal
          }
        }

        try {
          await createNotification({
            user_id: user.id,
            type: 'family_screen_time_limit',
            title: 'Screen-time limit reached',
            message: 'You have reached your daily CribsTalk screen-time limit.',
            data: {
              type: 'family_screen_time_limit',
              family_member_id: membership.id,
              url: '/settings?tab=family',
            },
          })
        } catch {
          // non-fatal
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
