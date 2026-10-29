import { NextRequest } from 'next/server'
import { createServiceClient, getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { createNotification } from '@/lib/notifications/createNotification'
import {
  ensureDefaultControls,
  getActiveMembership,
  hashInviteToken,
  isManagedRole,
} from '@/lib/family'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json().catch(() => ({}))
    const token = typeof body?.token === 'string' ? body.token.trim() : ''

    const existing = await getActiveMembership(supabase, user.id)
    if (existing) {
      return errorResponse('You already belong to a family', 400)
    }

    const service = createServiceClient()
    const { data: invitation, error } = await service
      .from('family_invitations')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error || !invitation) {
      return errorResponse('Invitation not found', 404)
    }

    if (invitation.status !== 'pending') {
      return errorResponse('Invitation is not pending', 400)
    }

    if (new Date(invitation.expires_at).getTime() < Date.now()) {
      await service
        .from('family_invitations')
        .update({ status: 'expired' })
        .eq('id', id)
      return errorResponse('Invitation has expired', 400)
    }

    const isInvitee =
      invitation.invitee_user_id === user.id ||
      (token && invitation.token_hash === hashInviteToken(token))

    if (!isInvitee) {
      // Also allow email match via auth email
      const { data: authUser } = await service.auth.admin.getUserById(user.id)
      const email = authUser?.user?.email?.toLowerCase()
      if (!email || invitation.invitee_email?.toLowerCase() !== email) {
        return errorResponse('Forbidden', 403)
      }
    }

    const now = new Date().toISOString()
    const { data: membership, error: memberError } = await service
      .from('family_members')
      .insert({
        family_id: invitation.family_id,
        user_id: user.id,
        role: invitation.role,
        status: 'active',
        joined_at: now,
      })
      .select('*')
      .single()

    if (memberError || !membership) {
      return errorResponse(memberError?.message || 'Failed to join family', 400)
    }

    await service
      .from('family_invitations')
      .update({
        status: 'accepted',
        invitee_user_id: user.id,
      })
      .eq('id', id)

    if (isManagedRole(invitation.role)) {
      await ensureDefaultControls(service, membership.id)
      await service.from('screen_time_rules').upsert(
        {
          family_member_id: membership.id,
          enabled: false,
        },
        { onConflict: 'family_member_id' }
      )
    }

    try {
      await createNotification({
        user_id: invitation.invited_by,
        type: 'family_invite_accepted',
        title: 'Family invitation accepted',
        message: 'Your family invitation was accepted.',
        data: {
          type: 'family_invite_accepted',
          invitation_id: id,
          family_id: invitation.family_id,
          member_id: membership.id,
          url: '/settings?tab=family',
        },
      })
    } catch (err) {
      console.error('Failed to notify inviter:', err)
    }

    return jsonResponse({ membership })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to accept invitation'
    if (message === 'Unauthorized' || message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(message, 500)
  }
}
