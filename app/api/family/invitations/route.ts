import { NextRequest } from 'next/server'
import { createServiceClient, getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { createNotification } from '@/lib/notifications/createNotification'
import {
  FamilyAuthError,
  findUserIdByEmail,
  generateInviteToken,
  getActiveMembership,
  requireParentOfFamily,
} from '@/lib/family'
import type { FamilyMemberRole } from '@/shared/types/family'

const VALID_ROLES: FamilyMemberRole[] = ['parent', 'child', 'teen']

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const scope = searchParams.get('scope') || 'incoming'

    if (scope === 'incoming') {
      const service = createServiceClient()
      const { data: byUser, error: byUserError } = await service
        .from('family_invitations')
        .select(
          'id, family_id, invited_by, invitee_user_id, invitee_email, role, status, expires_at, created_at'
        )
        .eq('invitee_user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (byUserError) return errorResponse(byUserError.message, 400)

      let byEmail: typeof byUser = []
      const email = user.email?.trim().toLowerCase()
      if (email) {
        const { data: emailRows, error: emailError } = await service
          .from('family_invitations')
          .select(
            'id, family_id, invited_by, invitee_user_id, invitee_email, role, status, expires_at, created_at'
          )
          .is('invitee_user_id', null)
          .ilike('invitee_email', email)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })

        if (emailError) return errorResponse(emailError.message, 400)
        byEmail = emailRows || []
      }

      const merged = [...(byUser || []), ...byEmail]
      const deduped = Array.from(new Map(merged.map((row) => [row.id, row])).values())
      return jsonResponse(deduped)
    }

    const membership = await getActiveMembership(supabase, user.id)
    if (!membership || membership.role !== 'parent') {
      return errorResponse('Only parents can list outgoing invitations', 403)
    }

    const { data, error } = await supabase
      .from('family_invitations')
      .select(
        'id, family_id, invited_by, invitee_user_id, invitee_email, role, status, expires_at, created_at'
      )
      .eq('family_id', membership.family_id)
      .order('created_at', { ascending: false })

    if (error) return errorResponse(error.message, 400)
    return jsonResponse(data || [])
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to list invitations'
    if (message === 'Unauthorized' || message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(message, 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json().catch(() => ({}))
    const familyId = typeof body?.family_id === 'string' ? body.family_id : ''
    const role = body?.role as FamilyMemberRole
    let inviteeUserId =
      typeof body?.invitee_user_id === 'string' ? body.invitee_user_id.trim() : ''
    let inviteeEmail =
      typeof body?.invitee_email === 'string' ? body.invitee_email.trim().toLowerCase() : ''

    if (!familyId) return errorResponse('family_id is required', 400)
    if (!VALID_ROLES.includes(role)) {
      return errorResponse('role must be parent, child, or teen', 400)
    }
    if (!inviteeUserId && !inviteeEmail) {
      return errorResponse('Email or user id is required', 400)
    }
    if (inviteeEmail && !inviteeEmail.includes('@')) {
      return errorResponse('Enter a valid email address', 400)
    }

    await requireParentOfFamily(supabase, user.id, familyId)

    const service = createServiceClient()

    // Prefer email: resolve to an existing CribsTalk account when possible.
    if (inviteeEmail && !inviteeUserId) {
      try {
        const resolvedId = await findUserIdByEmail(service, inviteeEmail)
        if (resolvedId) inviteeUserId = resolvedId
      } catch (err) {
        console.error('Failed to resolve invitee email:', err)
      }
    }

    if (inviteeUserId) {
      if (inviteeUserId === user.id) {
        return errorResponse('You cannot invite yourself', 400)
      }
      const existing = await getActiveMembership(service, inviteeUserId)
      if (existing) {
        return errorResponse(
          existing.family_id === familyId
            ? 'That user is already a member of this family'
            : 'That user already belongs to a family',
          400
        )
      }

      const { data: priorInFamily } = await service
        .from('family_members')
        .select('id, status')
        .eq('family_id', familyId)
        .eq('user_id', inviteeUserId)
        .neq('status', 'removed')
        .maybeSingle()

      if (priorInFamily) {
        return errorResponse('That user is already a member of this family', 400)
      }

      if (!inviteeEmail) {
        try {
          const { data: authUser } = await service.auth.admin.getUserById(inviteeUserId)
          inviteeEmail = authUser?.user?.email?.toLowerCase() || ''
        } catch {
          // optional
        }
      }
    }

    const { token, tokenHash } = generateInviteToken()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: invitation, error } = await service
      .from('family_invitations')
      .insert({
        family_id: familyId,
        invited_by: user.id,
        invitee_user_id: inviteeUserId || null,
        invitee_email: inviteeEmail || null,
        role,
        token_hash: tokenHash,
        status: 'pending',
        expires_at: expiresAt,
      })
      .select(
        'id, family_id, invited_by, invitee_user_id, invitee_email, role, status, expires_at, created_at'
      )
      .single()

    if (error || !invitation) {
      return errorResponse(error?.message || 'Failed to create invitation', 400)
    }

    if (inviteeUserId) {
      const { data: inviter } = await service
        .from('profiles')
        .select('full_name, username')
        .eq('id', user.id)
        .single()

      const { data: family } = await service
        .from('families')
        .select('name')
        .eq('id', familyId)
        .single()

      const inviterName = inviter?.full_name || inviter?.username || 'A parent'
      try {
        await createNotification({
          user_id: inviteeUserId,
          type: 'family_invite',
          title: 'Family invitation',
          message: `${inviterName} invited you to join ${family?.name || 'their family'} as a ${role}.`,
          data: {
            type: 'family_invite',
            invitation_id: invitation.id,
            family_id: familyId,
            role,
            url: '/settings?tab=family',
          },
        })
      } catch (err) {
        console.error('Failed to send family invite notification:', err)
      }
    }

    // Token returned once to inviter for optional share link; never stored plaintext.
    return jsonResponse({ ...invitation, token }, 201, 'Invitation created')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create invitation'
    if (message === 'Unauthorized' || message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    if (error instanceof FamilyAuthError) {
      return errorResponse(error.message, error.status)
    }
    return errorResponse(message, 500)
  }
}

/** Cancel invitation (parent). */
export async function PATCH(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json().catch(() => ({}))
    const invitationId = typeof body?.id === 'string' ? body.id : ''
    if (!invitationId) return errorResponse('id is required', 400)

    const service = createServiceClient()
    const { data: invitation, error } = await service
      .from('family_invitations')
      .select('*')
      .eq('id', invitationId)
      .maybeSingle()

    if (error || !invitation) return errorResponse('Invitation not found', 404)

    await requireParentOfFamily(supabase, user.id, invitation.family_id)

    if (invitation.status !== 'pending') {
      return errorResponse('Invitation is not pending', 400)
    }

    const { data, error: updateError } = await supabase
      .from('family_invitations')
      .update({ status: 'cancelled' })
      .eq('id', invitationId)
      .select(
        'id, family_id, invited_by, invitee_user_id, invitee_email, role, status, expires_at, created_at'
      )
      .single()

    if (updateError) return errorResponse(updateError.message, 400)
    return jsonResponse(data)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to cancel invitation'
    if (message === 'Unauthorized' || message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    if (error instanceof FamilyAuthError) {
      return errorResponse(error.message, error.status)
    }
    return errorResponse(message, 500)
  }
}
