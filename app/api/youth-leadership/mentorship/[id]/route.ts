import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { checkYouthLeadershipAccess } from '@/lib/youth-leadership/auth'
import { notifyYouthUser } from '@/lib/youth-leadership/notify'
import { getActiveMembership, isManagedRole } from '@/lib/family/auth'
import type {
  YouthGuardianApprovalStatus,
  YouthMentorshipStatus,
} from '@/shared/types/youthLeadership'

type Params = { params: Promise<{ id: string }> }

async function isParentOfYouth(
  supabase: Awaited<ReturnType<typeof getAuthenticatedUser>>['supabase'],
  parentUserId: string,
  youthUserId: string
): Promise<boolean> {
  const [parent, youth] = await Promise.all([
    getActiveMembership(supabase, parentUserId),
    getActiveMembership(supabase, youthUserId),
  ])
  return Boolean(
    parent &&
      youth &&
      parent.role === 'parent' &&
      isManagedRole(youth.role) &&
      parent.family_id === youth.family_id
  )
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json().catch(() => ({}))
    const action = (body.action || body.status) as string | undefined

    const { data: match } = await supabase
      .from('youth_mentorship_matches')
      .select(
        `
        *,
        mentor:youth_mentors!mentor_id(*)
      `
      )
      .eq('id', id)
      .maybeSingle()

    if (!match) return errorResponse('Mentorship not found', 404)

    const mentor = match.mentor as {
      id: string
      user_id: string
      verification_status: string
    } | null
    if (!mentor) return errorResponse('Mentor profile missing', 404)

    const isParticipant = match.participant_id === user.id
    const isMentor = mentor.user_id === user.id
    const isParent = await isParentOfYouth(supabase, user.id, match.participant_id)

    if (!isParticipant && !isMentor && !isParent) {
      return forbiddenResponse('Not authorized to update this mentorship.')
    }

    if (!isParent) {
      const access = await checkYouthLeadershipAccess(supabase, user.id)
      if (!access.allowed) {
        return errorResponse(access.message || 'Access restricted', 403, {
          code: access.code,
        })
      }
    }

    const updates: Record<string, unknown> = {}
    const nextGuardian = body.guardian_approval_status as
      | YouthGuardianApprovalStatus
      | undefined

    if (isParent && nextGuardian) {
      if (!['approved', 'rejected'].includes(nextGuardian)) {
        return errorResponse('guardian_approval_status must be approved or rejected', 400)
      }
      updates.guardian_approval_status = nextGuardian
      if (nextGuardian === 'approved' && match.status === 'pending_guardian') {
        updates.status = 'requested'
      }
      if (nextGuardian === 'rejected') {
        updates.status = 'cancelled'
      }
    }

    const normalized = (action || '').toLowerCase() as YouthMentorshipStatus | string

    if (normalized === 'accept' || normalized === 'active') {
      if (!isMentor) return forbiddenResponse('Only the mentor can accept.')
      if (mentor.verification_status !== 'verified') {
        return forbiddenResponse('Mentor must be verified to accept.')
      }
      if (match.guardian_approval_status === 'pending') {
        return errorResponse('Guardian approval is still pending.', 400)
      }
      if (match.guardian_approval_status === 'rejected') {
        return errorResponse('Guardian rejected this mentorship.', 400)
      }
      updates.status = 'active'
      updates.started_at = new Date().toISOString()
    } else if (normalized === 'decline' || normalized === 'declined') {
      if (!isMentor) return forbiddenResponse('Only the mentor can decline.')
      updates.status = 'declined'
      updates.ended_at = new Date().toISOString()
    } else if (normalized === 'cancel' || normalized === 'cancelled') {
      if (!isParticipant && !isMentor) {
        return forbiddenResponse('Only participant or mentor can cancel.')
      }
      updates.status = 'cancelled'
      updates.ended_at = new Date().toISOString()
    } else if (normalized === 'complete' || normalized === 'completed') {
      if (!isParticipant && !isMentor) {
        return forbiddenResponse('Only participant or mentor can complete.')
      }
      updates.status = 'completed'
      updates.ended_at = new Date().toISOString()
    } else if (body.goals !== undefined && (isParticipant || isMentor)) {
      updates.goals = body.goals
    } else if (body.progress_notes !== undefined && (isParticipant || isMentor)) {
      updates.progress_notes = body.progress_notes
    } else if (!nextGuardian) {
      return errorResponse(
        'Provide action: accept, decline, cancel, complete — or guardian_approval_status.',
        400
      )
    }

    if (Object.keys(updates).length === 0) {
      return errorResponse('No valid updates provided.', 400)
    }

    const { data: updated, error } = await supabase
      .from('youth_mentorship_matches')
      .update(updates)
      .eq('id', id)
      .select(
        `
        *,
        mentor:youth_mentors!mentor_id(
          *,
          profile:profiles!user_id(id, username, full_name, avatar_url)
        )
      `
      )
      .single()

    if (error) return errorResponse(error.message, 400)

    if (updates.status === 'active' && match.status !== 'active') {
      await notifyYouthUser({
        user_id: match.participant_id,
        type: 'youth_mentorship_accepted',
        title: 'Mentorship accepted',
        message: 'Your mentorship request was accepted.',
        data: {
          mentorship_id: id,
          href: '/youth-leadership/mentorship',
        },
      })
    }

    return jsonResponse(updated)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to update mentorship', 500)
  }
}
