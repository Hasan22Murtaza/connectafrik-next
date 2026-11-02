import { NextRequest } from 'next/server'
import { createServiceClient, getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  FamilyAuthError,
  FAMILY_PARENT_MIN_AGE,
  getActiveMembership,
  isAdultForFamily,
} from '@/lib/family'

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const membership = await getActiveMembership(supabase, user.id)

    if (!membership) {
      return jsonResponse({ family: null, membership: null, members: [] })
    }

    const { data: family, error: familyError } = await supabase
      .from('families')
      .select('*')
      .eq('id', membership.family_id)
      .single()

    if (familyError || !family) {
      return errorResponse(familyError?.message || 'Family not found', 404)
    }

    const { data: members, error: membersError } = await supabase
      .from('family_members')
      .select('id, family_id, user_id, role, relationship, status, joined_at, created_at, updated_at')
      .eq('family_id', membership.family_id)
      .neq('status', 'removed')
      .order('created_at', { ascending: true })

    if (membersError) {
      return errorResponse(membersError.message, 400)
    }

    const userIds = (members || []).map((m) => m.user_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000'])

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]))
    const enriched = (members || []).map((m) => ({
      ...m,
      profile: profileMap.get(m.user_id) || null,
    }))

    return jsonResponse({
      family,
      membership,
      members: enriched,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load family'
    if (message === 'Unauthorized' || message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    if (error instanceof FamilyAuthError) {
      return errorResponse(error.message, error.status)
    }
    return errorResponse(message, 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json().catch(() => ({}))
    const name = typeof body?.name === 'string' ? body.name.trim() : ''

    if (!name || name.length > 80) {
      return errorResponse('Family name is required (max 80 characters)', 400)
    }

    const existing = await getActiveMembership(supabase, user.id)
    if (existing) {
      return errorResponse('You already belong to a family', 400)
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('birthday')
      .eq('id', user.id)
      .maybeSingle()

    if (!isAdultForFamily(profile?.birthday)) {
      return errorResponse(
        `Only adults ${FAMILY_PARENT_MIN_AGE}+ can create a family`,
        403
      )
    }

    // Service role for bootstrap only — auth already verified above.
    // Avoids INSERT…RETURNING failing SELECT RLS before parent membership exists.
    const service = createServiceClient()

    const { data: family, error: familyError } = await service
      .from('families')
      .insert({
        name,
        created_by: user.id,
        status: 'active',
      })
      .select('*')
      .single()

    if (familyError || !family) {
      return errorResponse(familyError?.message || 'Failed to create family', 400)
    }

    const now = new Date().toISOString()
    const { data: membership, error: memberError } = await service
      .from('family_members')
      .insert({
        family_id: family.id,
        user_id: user.id,
        role: 'parent',
        status: 'active',
        joined_at: now,
      })
      .select('*')
      .single()

    if (memberError || !membership) {
      // Best-effort cleanup; family without parent is unusable
      await service.from('families').update({ status: 'archived' }).eq('id', family.id)
      return errorResponse(memberError?.message || 'Failed to create parent membership', 400)
    }

    return jsonResponse({ family, membership }, 201, 'Family created')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create family'
    if (message === 'Unauthorized' || message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(message, 500)
  }
}
