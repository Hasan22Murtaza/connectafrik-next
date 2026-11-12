import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { errorResponse, jsonResponse, unauthorizedResponse } from '@/lib/api-utils'
import { checkYouthLeadershipAccess } from '@/lib/youth-leadership/auth'
import { notifyYouthUser } from '@/lib/youth-leadership/notify'
import { getActiveMembership, isManagedRole } from '@/lib/family/auth'

const MATCH_SELECT = `
  *,
  mentor:youth_mentors!mentor_id(
    *,
    profile:profiles!user_id(id, username, full_name, avatar_url)
  )
`

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const access = await checkYouthLeadershipAccess(supabase, user.id)
    if (!access.allowed) {
      return errorResponse(access.message || 'Access restricted', 403, {
        code: access.code,
      })
    }

    const status = new URL(request.url).searchParams.get('status')

    const { data: myMentor } = await supabase
      .from('youth_mentors')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    let asParticipant = supabase
      .from('youth_mentorship_matches')
      .select(MATCH_SELECT)
      .eq('participant_id', user.id)

    if (status) asParticipant = asParticipant.eq('status', status)

    const { data: participantMatches, error: pError } = await asParticipant.order(
      'created_at',
      { ascending: false }
    )
    if (pError) return errorResponse(pError.message, 400)

    let mentorMatches: any[] = []
    if (myMentor?.id) {
      let asMentor = supabase
        .from('youth_mentorship_matches')
        .select(
          `
          *,
          participant:profiles!participant_id(id, username, full_name, avatar_url),
          mentor:youth_mentors!mentor_id(*)
        `
        )
        .eq('mentor_id', myMentor.id)
      if (status) asMentor = asMentor.eq('status', status)
      const { data, error } = await asMentor.order('created_at', { ascending: false })
      if (error) return errorResponse(error.message, 400)
      mentorMatches = data || []
    }

    return jsonResponse({
      as_participant: participantMatches || [],
      as_mentor: mentorMatches,
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load mentorships', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const access = await checkYouthLeadershipAccess(supabase, user.id)
    if (!access.allowed) {
      return errorResponse(access.message || 'Access restricted', 403, {
        code: access.code,
      })
    }

    const body = await request.json()
    const mentorId = body.mentor_id as string
    if (!mentorId) return errorResponse('mentor_id is required', 400)

    const { data: mentor } = await supabase
      .from('youth_mentors')
      .select('*')
      .eq('id', mentorId)
      .maybeSingle()

    if (!mentor) return errorResponse('Mentor not found', 404)
    if (mentor.verification_status !== 'verified') {
      return errorResponse('This mentor is not verified yet.', 400)
    }
    if (mentor.user_id === user.id) {
      return errorResponse('You cannot request mentorship from yourself.', 400)
    }

    const membership = await getActiveMembership(supabase, user.id)
    const isManagedMinor = Boolean(membership && isManagedRole(membership.role))

    let status: 'requested' | 'pending_guardian' = 'requested'
    let guardianApproval: 'not_required' | 'pending' = 'not_required'

    if (isManagedMinor) {
      if (!mentor.accepts_minors) {
        return errorResponse('This mentor does not accept minors.', 403)
      }
      status = 'pending_guardian'
      guardianApproval = 'pending'
    }

    const row = {
      mentor_id: mentorId,
      participant_id: user.id,
      program_id: body.program_id ?? null,
      status,
      goals: Array.isArray(body.goals) ? body.goals : [],
      guardian_approval_status: guardianApproval,
    }

    const { data: existing } = await supabase
      .from('youth_mentorship_matches')
      .select('id, status')
      .eq('mentor_id', mentorId)
      .eq('participant_id', user.id)
      .maybeSingle()

    if (existing && !['declined', 'cancelled', 'completed'].includes(existing.status)) {
      return errorResponse('You already have an open mentorship request with this mentor.', 400)
    }

    let result
    if (existing) {
      const { data, error } = await supabase
        .from('youth_mentorship_matches')
        .update(row)
        .eq('id', existing.id)
        .select(MATCH_SELECT)
        .single()
      if (error) return errorResponse(error.message, 400)
      result = data
    } else {
      const { data, error } = await supabase
        .from('youth_mentorship_matches')
        .insert(row)
        .select(MATCH_SELECT)
        .single()
      if (error) return errorResponse(error.message, 400)
      result = data
    }

    await notifyYouthUser({
      user_id: mentor.user_id,
      type: 'youth_mentorship_request',
      title: 'New mentorship request',
      message: 'A participant requested mentorship from you.',
      data: {
        mentorship_id: result.id,
        mentor_id: mentorId,
        href: '/youth-leadership/mentorship',
      },
    })

    if (guardianApproval === 'pending' && membership) {
      const { data: parents } = await supabase
        .from('family_members')
        .select('user_id')
        .eq('family_id', membership.family_id)
        .eq('role', 'parent')
        .eq('status', 'active')
      for (const p of parents || []) {
        await notifyYouthUser({
          user_id: p.user_id,
          type: 'youth_guardian_approval',
          title: 'Mentorship approval needed',
          message: 'Please review a Youth Leadership mentorship request.',
          data: {
            mentorship_id: result.id,
            child_user_id: user.id,
            href: '/youth-leadership/guardian',
          },
        })
      }
    }

    return jsonResponse(result, existing ? 200 : 201)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to request mentorship', 500)
  }
}
