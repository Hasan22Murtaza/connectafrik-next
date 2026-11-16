import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { isPlatformYouthAdmin } from '@/lib/youth-leadership/auth'

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    if (!(await isPlatformYouthAdmin(supabase, user.id))) {
      return forbiddenResponse('Platform admin access required.')
    }

    const { searchParams } = new URL(request.url)
    const orgStatus = searchParams.get('org_status')
    const programStatus = searchParams.get('program_status')
    const mentorStatus = searchParams.get('mentor_status') || 'pending'
    const safetyStatus = searchParams.get('safety_status') || 'open'

    const [
      orgsRes,
      programsRes,
      mentorsRes,
      safetyRes,
      appsRes,
      enrollmentsRes,
    ] = await Promise.all([
      (() => {
        let q = supabase
          .from('youth_organizations')
          .select(
            'id, name, country, region, verification_status, created_at, verified_at'
          )
          .order('created_at', { ascending: false })
          .limit(100)
        if (orgStatus) q = q.eq('verification_status', orgStatus)
        return q
      })(),
      (() => {
        let q = supabase
          .from('youth_programs')
          .select(
            `
            id, title, status, organization_id, created_at, published_at,
            organization:youth_organizations!organization_id(id, name)
          `
          )
          .order('created_at', { ascending: false })
          .limit(100)
        if (programStatus) q = q.eq('status', programStatus)
        return q
      })(),
      (() => {
        let q = supabase
          .from('youth_mentors')
          .select(
            `
            id, user_id, bio, verification_status, created_at,
            profile:profiles!user_id(id, username, full_name, avatar_url)
          `
          )
          .order('created_at', { ascending: false })
          .limit(100)
        if (mentorStatus) q = q.eq('verification_status', mentorStatus)
        return q
      })(),
      (() => {
        let q = supabase
          .from('youth_safety_reports')
          .select(
            'id, report_type, description, status, created_at, organization_id, program_id, reporter_id'
          )
          .order('created_at', { ascending: false })
          .limit(100)
        if (safetyStatus) q = q.eq('status', safetyStatus)
        return q
      })(),
      supabase
        .from('youth_program_applications')
        .select('id', { count: 'exact', head: true }),
      supabase
        .from('youth_program_enrollments')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active'),
    ])

    if (orgsRes.error) return errorResponse(orgsRes.error.message, 400)
    if (programsRes.error) return errorResponse(programsRes.error.message, 400)
    if (mentorsRes.error) return errorResponse(mentorsRes.error.message, 400)
    if (safetyRes.error) return errorResponse(safetyRes.error.message, 400)

    const [
      { count: pendingOrgs },
      { count: publishedPrograms },
      { count: pendingPrograms },
      { count: pendingMentors },
      { count: openSafety },
    ] = await Promise.all([
      supabase
        .from('youth_organizations')
        .select('id', { count: 'exact', head: true })
        .eq('verification_status', 'pending'),
      supabase
        .from('youth_programs')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'published'),
      supabase
        .from('youth_programs')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending_review'),
      supabase
        .from('youth_mentors')
        .select('id', { count: 'exact', head: true })
        .eq('verification_status', 'pending'),
      supabase
        .from('youth_safety_reports')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'open'),
    ])

    return jsonResponse({
      summary: {
        pending_organizations: pendingOrgs ?? 0,
        published_programs: publishedPrograms ?? 0,
        pending_programs: pendingPrograms ?? 0,
        pending_mentors: pendingMentors ?? 0,
        open_safety_reports: openSafety ?? 0,
        total_applications: appsRes.count ?? 0,
        active_enrollments: enrollmentsRes.count ?? 0,
      },
      organizations: orgsRes.data || [],
      programs: programsRes.data || [],
      mentors_pending: mentorsRes.data || [],
      safety_reports: safetyRes.data || [],
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load admin overview', 500)
  }
}
