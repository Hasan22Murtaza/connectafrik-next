import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { createNotification } from '@/lib/notifications/createNotification'
import {
  FamilyAuthError,
  ensureDefaultControls,
  getActiveMembership,
  isManagedRole,
  requireParentOfMember,
} from '@/lib/family'

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

    const controls = await ensureDefaultControls(supabase, id)
    return jsonResponse(controls)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load controls'
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
      return errorResponse('Controls only apply to child or teen members', 400)
    }

    await ensureDefaultControls(supabase, id)
    const body = await request.json().catch(() => ({}))

    const updates: Record<string, unknown> = {}
    const boolKeys = [
      'friend_request_approval',
      'messaging_enabled',
      'calling_enabled',
      'group_joining_enabled',
      'marketplace_enabled',
      'screen_time_enabled',
    ] as const

    for (const key of boolKeys) {
      if (typeof body?.[key] === 'boolean') updates[key] = body[key]
    }

    if (
      body?.content_filter_level === null ||
      body?.content_filter_level === 'off' ||
      body?.content_filter_level === 'low' ||
      body?.content_filter_level === 'medium' ||
      body?.content_filter_level === 'high'
    ) {
      updates.content_filter_level = body.content_filter_level
    }

    if (typeof body?.profile_visibility === 'string' || body?.profile_visibility === null) {
      updates.profile_visibility = body.profile_visibility
    }

    if (typeof body?.location_sharing === 'boolean' || body?.location_sharing === null) {
      updates.location_sharing = body.location_sharing
    }

    if (Object.keys(updates).length === 0) {
      return errorResponse('No valid fields to update', 400)
    }

    const { data, error } = await supabase
      .from('parental_controls')
      .update(updates)
      .eq('family_member_id', id)
      .select('*')
      .single()

    if (error) return errorResponse(error.message, 400)

    try {
      await createNotification({
        user_id: target.user_id,
        type: 'family_controls_updated',
        title: 'Family controls updated',
        message: 'Your parent changed some settings on your CribsTalk account.',
        data: {
          type: 'family_controls_updated',
          family_member_id: id,
          url: '/settings?tab=family',
        },
      })
    } catch (err) {
      console.error('Failed to notify child of controls update:', err)
    }

    return jsonResponse(data)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update controls'
    if (message === 'Unauthorized' || message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    if (error instanceof FamilyAuthError) {
      return errorResponse(error.message, error.status)
    }
    return errorResponse(message, 500)
  }
}
