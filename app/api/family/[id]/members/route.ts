import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { FamilyAuthError, getActiveMembership, requireParentOfFamily } from '@/lib/family'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)
    const membership = await getActiveMembership(supabase, user.id)

    if (!membership || membership.family_id !== id) {
      return errorResponse('Forbidden', 403)
    }

    const { data: members, error } = await supabase
      .from('family_members')
      .select('id, family_id, user_id, role, relationship, status, joined_at, created_at, updated_at')
      .eq('family_id', id)
      .neq('status', 'removed')
      .order('created_at', { ascending: true })

    if (error) return errorResponse(error.message, 400)

    const userIds = (members || []).map((m) => m.user_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000'])

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]))
    return jsonResponse(
      (members || []).map((m) => ({ ...m, profile: profileMap.get(m.user_id) || null }))
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to list members'
    if (message === 'Unauthorized' || message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(message, 500)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: familyId } = await params
    const { user, supabase } = await getAuthenticatedUser(request)
    await requireParentOfFamily(supabase, user.id, familyId)

    const body = await request.json().catch(() => ({}))
    const memberId = typeof body?.member_id === 'string' ? body.member_id : ''
    if (!memberId) return errorResponse('member_id is required', 400)

    const { data: target, error: fetchError } = await supabase
      .from('family_members')
      .select('*')
      .eq('id', memberId)
      .eq('family_id', familyId)
      .maybeSingle()

    if (fetchError || !target) {
      return errorResponse('Member not found', 404)
    }

    if (target.user_id === user.id) {
      return errorResponse('You cannot remove yourself with this endpoint', 400)
    }

    const { data, error } = await supabase
      .from('family_members')
      .update({ status: 'removed' })
      .eq('id', memberId)
      .select('*')
      .single()

    if (error) return errorResponse(error.message, 400)
    return jsonResponse(data)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to remove member'
    if (message === 'Unauthorized' || message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    if (error instanceof FamilyAuthError) {
      return errorResponse(error.message, error.status)
    }
    return errorResponse(message, 500)
  }
}
