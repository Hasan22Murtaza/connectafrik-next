import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { requireOrgRole } from '@/lib/youth-leadership/auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)

    const authz = await requireOrgRole(supabase, id, user.id, 'viewer')
    if (!authz.ok) return forbiddenResponse(authz.message)

    const { data: programs, error: progError } = await supabase
      .from('youth_programs')
      .select('id, status')
      .eq('organization_id', id)

    if (progError) return errorResponse(progError.message, 400)

    const programList = programs || []
    const programIds = programList.map((p) => p.id)
    const totalPrograms = programList.length
    const activePrograms = programList.filter((p) =>
      ['published', 'closed'].includes(p.status)
    ).length

    let totalApplications = 0
    let acceptedApplications = 0
    let pendingApplications = 0
    let completedEnrollments = 0
    let activeEnrollments = 0

    if (programIds.length > 0) {
      const [
        totalAppsRes,
        acceptedAppsRes,
        pendingAppsRes,
        activeEnrollRes,
        completedEnrollRes,
      ] = await Promise.all([
        supabase
          .from('youth_program_applications')
          .select('id', { count: 'exact', head: true })
          .in('program_id', programIds),
        supabase
          .from('youth_program_applications')
          .select('id', { count: 'exact', head: true })
          .in('program_id', programIds)
          .eq('status', 'accepted'),
        supabase
          .from('youth_program_applications')
          .select('id', { count: 'exact', head: true })
          .in('program_id', programIds)
          .in('status', ['submitted', 'under_review']),
        supabase
          .from('youth_program_enrollments')
          .select('id', { count: 'exact', head: true })
          .in('program_id', programIds)
          .eq('status', 'active'),
        supabase
          .from('youth_program_enrollments')
          .select('id', { count: 'exact', head: true })
          .in('program_id', programIds)
          .eq('status', 'completed'),
      ])

      totalApplications = totalAppsRes.count ?? 0
      acceptedApplications = acceptedAppsRes.count ?? 0
      pendingApplications = pendingAppsRes.count ?? 0
      activeEnrollments = activeEnrollRes.count ?? 0
      completedEnrollments = completedEnrollRes.count ?? 0
    }

    const enrollmentTotal = activeEnrollments + completedEnrollments
    const completionRate =
      enrollmentTotal > 0
        ? Math.round((completedEnrollments / enrollmentTotal) * 1000) / 10
        : 0

    const now = new Date().toISOString()
    const { count: upcomingEvents, error: eventError } = await supabase
      .from('youth_events')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', id)
      .in('status', ['scheduled', 'ongoing'])
      .gte('start_at', now)

    if (eventError) return errorResponse(eventError.message, 400)

    return jsonResponse({
      organization_id: id,
      total_programs: totalPrograms,
      active_programs: activePrograms,
      total_applications: totalApplications,
      accepted_applications: acceptedApplications,
      pending_applications: pendingApplications,
      completion_rate: completionRate,
      upcoming_events: upcomingEvents ?? 0,
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load analytics', 500)
  }
}
