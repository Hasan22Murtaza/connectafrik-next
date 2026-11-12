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
      const [{ data: apps }, { data: enrollments }] = await Promise.all([
        supabase
          .from('youth_program_applications')
          .select('id, status')
          .in('program_id', programIds),
        supabase
          .from('youth_program_enrollments')
          .select('id, status')
          .in('program_id', programIds),
      ])

      totalApplications = (apps || []).length
      acceptedApplications = (apps || []).filter((a) => a.status === 'accepted').length
      pendingApplications = (apps || []).filter((a) =>
        ['submitted', 'under_review'].includes(a.status)
      ).length
      activeEnrollments = (enrollments || []).filter((e) => e.status === 'active').length
      completedEnrollments = (enrollments || []).filter(
        (e) => e.status === 'completed'
      ).length
    }

    const enrollmentTotal = activeEnrollments + completedEnrollments
    const completionRate =
      enrollmentTotal > 0
        ? Math.round((completedEnrollments / enrollmentTotal) * 1000) / 10
        : 0

    const now = new Date().toISOString()
    const { count: upcomingEvents, error: eventError } = await supabase
      .from('youth_events')
      .select('*', { count: 'exact', head: true })
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
