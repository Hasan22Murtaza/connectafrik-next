import type { SupabaseClient } from '@supabase/supabase-js'
import { createNotification } from '@/lib/notifications/createNotification'
import { sendFamilyParentVerificationEmail } from '@/shared/services/emailService'
import { generateInviteToken, hashInviteToken } from './tokens'
import { getActiveMembership } from './auth'

export type FamilyVerificationType = 'birthday_change' | 'child_removal'

const VERIFICATION_TTL_MS = 48 * 60 * 60 * 1000

export async function getActiveFamilyParents(
  supabase: SupabaseClient,
  familyId: string
): Promise<Array<{ user_id: string; email: string | null; name: string }>> {
  const { data: parents, error } = await supabase
    .from('family_members')
    .select('user_id')
    .eq('family_id', familyId)
    .eq('role', 'parent')
    .eq('status', 'active')

  if (error) throw new Error(error.message)
  if (!parents?.length) return []

  const results: Array<{ user_id: string; email: string | null; name: string }> = []
  for (const parent of parents) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, username')
      .eq('id', parent.user_id)
      .maybeSingle()

    let email: string | null = null
    try {
      const { data: authUser } = await supabase.auth.admin.getUserById(parent.user_id)
      email = authUser?.user?.email?.toLowerCase() || null
    } catch {
      email = null
    }

    results.push({
      user_id: parent.user_id,
      email,
      name: profile?.full_name || profile?.username || 'Parent',
    })
  }
  return results
}

export async function createFamilyVerificationRequest(
  supabase: SupabaseClient,
  params: {
    familyId: string
    type: FamilyVerificationType
    requesterUserId: string
    targetMemberId: string
    payload?: Record<string, unknown>
    childName: string
  }
): Promise<{ id: string; token: string; expires_at: string }> {
  // Cancel any prior pending request of the same type for this member.
  await supabase
    .from('family_verification_requests')
    .update({ status: 'cancelled', resolved_at: new Date().toISOString() })
    .eq('target_member_id', params.targetMemberId)
    .eq('type', params.type)
    .eq('status', 'pending')

  const { token, tokenHash } = generateInviteToken()
  const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS).toISOString()

  const { data, error } = await supabase
    .from('family_verification_requests')
    .insert({
      family_id: params.familyId,
      type: params.type,
      requester_user_id: params.requesterUserId,
      target_member_id: params.targetMemberId,
      payload: params.payload || {},
      token_hash: tokenHash,
      status: 'pending',
      expires_at: expiresAt,
    })
    .select('id, expires_at')
    .single()

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create verification request')
  }

  const parents = await getActiveFamilyParents(supabase, params.familyId)
  const actionLabel =
    params.type === 'birthday_change'
      ? 'approve a date of birth change'
      : 'confirm removing a child from your family'

  for (const parent of parents) {
    if (parent.email) {
      try {
        await sendFamilyParentVerificationEmail(parent.email, {
          parentName: parent.name,
          childName: params.childName,
          actionLabel,
          type: params.type,
          token,
        })
      } catch (err) {
        console.error('Failed to send family verification email:', err)
      }
    }

    try {
      await createNotification({
        user_id: parent.user_id,
        type: 'family_verification_required',
        title:
          params.type === 'birthday_change'
            ? 'Approve birthday change'
            : 'Confirm child removal',
        message:
          params.type === 'birthday_change'
            ? `${params.childName} requested a date of birth update. Verify by email to allow the change.`
            : `Confirm by email to remove ${params.childName} from your family.`,
        data: {
          type: 'family_verification_required',
          verification_id: data.id,
          verification_type: params.type,
          family_member_id: params.targetMemberId,
          url: `/family-circle/verify?token=${encodeURIComponent(token)}`,
        },
      })
    } catch (err) {
      console.error('Failed to notify parent of verification request:', err)
    }
  }

  return { id: data.id, token, expires_at: data.expires_at }
}

export async function approveFamilyVerificationByToken(
  supabase: SupabaseClient,
  token: string
): Promise<{ type: FamilyVerificationType; message: string }> {
  const tokenHash = hashInviteToken(token.trim())
  const { data: request, error } = await supabase
    .from('family_verification_requests')
    .select('*')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (error || !request) {
    throw new Error('Verification link is invalid')
  }

  if (request.status !== 'pending') {
    throw new Error('This verification request is no longer pending')
  }

  if (new Date(request.expires_at).getTime() < Date.now()) {
    await supabase
      .from('family_verification_requests')
      .update({ status: 'expired', resolved_at: new Date().toISOString() })
      .eq('id', request.id)
    throw new Error('This verification link has expired')
  }

  if (request.type === 'birthday_change') {
    const nextBirthday =
      typeof request.payload?.birthday === 'string' ? request.payload.birthday : null
    if (!nextBirthday) throw new Error('Birthday payload missing')

    const { data: member } = await supabase
      .from('family_members')
      .select('user_id')
      .eq('id', request.target_member_id)
      .maybeSingle()

    if (!member) throw new Error('Family member not found')

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ birthday: nextBirthday, updated_at: new Date().toISOString() })
      .eq('id', member.user_id)

    if (profileError) throw new Error(profileError.message)
  } else if (request.type === 'child_removal') {
    const { error: removeError } = await supabase
      .from('family_members')
      .update({ status: 'removed' })
      .eq('id', request.target_member_id)

    if (removeError) throw new Error(removeError.message)
  }

  await supabase
    .from('family_verification_requests')
    .update({ status: 'approved', resolved_at: new Date().toISOString() })
    .eq('id', request.id)

  return {
    type: request.type as FamilyVerificationType,
    message:
      request.type === 'birthday_change'
        ? 'Birthday change approved and applied.'
        : 'Child removed from the family.',
  }
}

/** Gate birthday updates for active Child members — returns true if gated (pending parent). */
export async function maybeGateChildBirthdayUpdate(
  supabase: SupabaseClient,
  params: {
    userId: string
    nextBirthday: string
    currentBirthday?: string | null
  }
): Promise<{ gated: boolean; message?: string }> {
  if (!params.nextBirthday || params.nextBirthday === params.currentBirthday) {
    return { gated: false }
  }

  const membership = await getActiveMembership(supabase, params.userId)
  if (!membership || membership.role !== 'child') {
    return { gated: false }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, username')
    .eq('id', params.userId)
    .maybeSingle()

  await createFamilyVerificationRequest(supabase, {
    familyId: membership.family_id,
    type: 'birthday_change',
    requesterUserId: params.userId,
    targetMemberId: membership.id,
    payload: { birthday: params.nextBirthday },
    childName: profile?.full_name || profile?.username || 'Your child',
  })

  return {
    gated: true,
    message:
      'A verification email was sent to your parent. Your date of birth will update after they approve it.',
  }
}
