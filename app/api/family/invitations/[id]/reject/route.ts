import { NextRequest } from 'next/server'
import { createServiceClient, getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { hashInviteToken } from '@/lib/family'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { user } = await getAuthenticatedUser(request)
    const body = await request.json().catch(() => ({}))
    const token = typeof body?.token === 'string' ? body.token.trim() : ''

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

    const isInvitee =
      invitation.invitee_user_id === user.id ||
      (token && invitation.token_hash === hashInviteToken(token))

    if (!isInvitee) {
      const { data: authUser } = await service.auth.admin.getUserById(user.id)
      const email = authUser?.user?.email?.toLowerCase()
      if (!email || invitation.invitee_email?.toLowerCase() !== email) {
        return errorResponse('Forbidden', 403)
      }
    }

    const { data, error: updateError } = await service
      .from('family_invitations')
      .update({ status: 'rejected', invitee_user_id: user.id })
      .eq('id', id)
      .select(
        'id, family_id, invited_by, invitee_user_id, invitee_email, role, status, expires_at, created_at'
      )
      .single()

    if (updateError) return errorResponse(updateError.message, 400)
    return jsonResponse(data)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to reject invitation'
    if (message === 'Unauthorized' || message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(message, 500)
  }
}
