import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { errorResponse, jsonResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getActiveMembership } from '@/lib/family/auth'

/**
 * Parent/guardian inbox: pending Youth Leadership approvals for managed children.
 * Does not expose private messages or unrelated family data.
 */
export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const membership = await getActiveMembership(supabase, user.id)
    if (!membership || membership.role !== 'parent') {
      return jsonResponse({
        applications: [],
        mentorships: [],
      })
    }

    const { data: children } = await supabase
      .from('family_members')
      .select('user_id')
      .eq('family_id', membership.family_id)
      .in('role', ['child', 'teen'])
      .eq('status', 'active')

    const childIds = (children || []).map((c) => c.user_id)
    if (childIds.length === 0) {
      return jsonResponse({ applications: [], mentorships: [] })
    }

    const [{ data: applications, error: appError }, { data: mentorships, error: mentError }] =
      await Promise.all([
        supabase
          .from('youth_program_applications')
          .select(
            `
            id, program_id, user_id, status, guardian_approval_status, submitted_at, created_at,
            program:youth_programs!program_id(id, title, organization_id),
            applicant:profiles!user_id(id, username, full_name, avatar_url)
          `
          )
          .in('user_id', childIds)
          .eq('guardian_approval_status', 'pending')
          .order('created_at', { ascending: false }),
        supabase
          .from('youth_mentorship_matches')
          .select(
            `
            id, mentor_id, participant_id, status, guardian_approval_status, created_at,
            mentor:youth_mentors!mentor_id(
              id, user_id, expertise, verification_status,
              profile:profiles!user_id(id, username, full_name, avatar_url)
            ),
            participant:profiles!participant_id(id, username, full_name, avatar_url)
          `
          )
          .in('participant_id', childIds)
          .eq('guardian_approval_status', 'pending')
          .order('created_at', { ascending: false }),
      ])

    if (appError) return errorResponse(appError.message, 400)
    if (mentError) return errorResponse(mentError.message, 400)

    return jsonResponse({
      applications: applications || [],
      mentorships: mentorships || [],
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load guardian queue', 500)
  }
}
