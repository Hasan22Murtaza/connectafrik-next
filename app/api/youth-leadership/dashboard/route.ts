import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { errorResponse, jsonResponse, unauthorizedResponse } from '@/lib/api-utils'
import { checkYouthLeadershipAccess } from '@/lib/youth-leadership/auth'
import type { YouthDashboardSummary } from '@/shared/types/youthLeadership'

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const access = await checkYouthLeadershipAccess(supabase, user.id)
    if (!access.allowed) {
      return errorResponse(access.message || 'Access restricted', 403, {
        code: access.code,
      })
    }

    const now = new Date().toISOString()
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const [
      enrollmentsRes,
      applicationsRes,
      eventsRes,
      projectMembersRes,
      mentorshipRes,
      achievementsRes,
      myMentorRes,
      tasksRes,
      openAppsRes,
    ] = await Promise.all([
      supabase
        .from('youth_program_enrollments')
        .select('id, status, program_id')
        .eq('user_id', user.id),
      supabase
        .from('youth_program_applications')
        .select('id, status')
        .eq('user_id', user.id),
      supabase
        .from('youth_event_attendance')
        .select(
          `
          id,
          event:youth_events!event_id(*)
        `
        )
        .eq('user_id', user.id)
        .eq('attendance_status', 'registered'),
      supabase
        .from('youth_project_members')
        .select(
          `
          id, status, project_id,
          project:youth_projects!project_id(id, title, status, skills_required)
        `
        )
        .eq('user_id', user.id)
        .in('status', ['active', 'invited', 'completed']),
      supabase
        .from('youth_mentorship_matches')
        .select(
          `
          *,
          mentor:youth_mentors!mentor_id(*)
        `
        )
        .eq('participant_id', user.id)
        .in('status', ['requested', 'pending_guardian', 'active']),
      supabase
        .from('youth_achievements')
        .select('*')
        .eq('user_id', user.id),
      supabase
        .from('youth_mentors')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('youth_project_tasks')
        .select('*')
        .eq('assigned_to', user.id)
        .in('status', ['todo', 'in_progress'])
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(10),
      supabase
        .from('youth_program_applications')
        .select('program_id')
        .eq('user_id', user.id)
        .in('status', ['draft', 'submitted', 'under_review', 'waitlisted']),
    ])

    let mentorMatches: any[] = []
    if (myMentorRes.data?.id) {
      const { data } = await supabase
        .from('youth_mentorship_matches')
        .select('*')
        .eq('mentor_id', myMentorRes.data.id)
        .in('status', ['requested', 'pending_guardian', 'active'])
      mentorMatches = data || []
    }

    const enrollments = enrollmentsRes.data || []
    const applications = applicationsRes.data || []
    const achievements = achievementsRes.data || []
    const projectMembers = projectMembersRes.data || []
    const participantMentorships = mentorshipRes.data || []

    const activePrograms = enrollments.filter((e) => e.status === 'active').length
    const programsCompleted = enrollments.filter((e) => e.status === 'completed').length
    const currentProjects = projectMembers.filter(
      (m: any) =>
        m.status === 'active' &&
        m.project &&
        ['approved', 'active'].includes(m.project.status)
    ).length
    const projectsCompleted = projectMembers.filter(
      (m: any) =>
        m.status === 'completed' ||
        (m.project && m.project.status === 'completed')
    ).length

    const upcomingEvents = (eventsRes.data || [])
      .map((row: any) => row.event)
      .filter(
        (e: any) =>
          e &&
          ['scheduled', 'ongoing'].includes(e.status) &&
          e.start_at >= now
      )
      .sort((a: any, b: any) => a.start_at.localeCompare(b.start_at))
      .slice(0, 10)

    const skills = new Set<string>()
    for (const a of achievements) {
      for (const s of a.skills || []) skills.add(s)
    }
    for (const m of projectMembers) {
      for (const s of (m as any).project?.skills_required || []) skills.add(s)
    }

    const myAppProgramIds = new Set(
      (openAppsRes.data || []).map((a) => a.program_id)
    )

    const { data: deadlinePrograms } = await supabase
      .from('youth_programs')
      .select(
        `
        *,
        organization:youth_organizations!organization_id(id, name, logo_url, verification_status, country, region),
        category:youth_program_categories!category_id(id, slug, name)
      `
      )
      .eq('status', 'published')
      .not('application_deadline', 'is', null)
      .gte('application_deadline', now)
      .lte('application_deadline', in30Days)
      .order('application_deadline', { ascending: true })
      .limit(20)

    const applicationDeadlines = (deadlinePrograms || []).filter((p) =>
      myAppProgramIds.has(p.id)
    )

    const summary: YouthDashboardSummary = {
      active_programs: activePrograms,
      applications: applications.length,
      upcoming_events: upcomingEvents.length,
      current_projects: currentProjects,
      mentorships: participantMentorships.length + mentorMatches.length,
      achievements: achievements.length,
      certificates: achievements.filter(
        (a) => a.certificate_url || a.achievement_type === 'certificate'
      ).length,
      programs_completed: programsCompleted,
      projects_completed: projectsCompleted,
      skills: Array.from(skills),
      upcoming: {
        application_deadlines: applicationDeadlines as any,
        events: upcomingEvents,
        tasks: tasksRes.data || [],
        mentorship_sessions: [
          ...participantMentorships,
          ...mentorMatches,
        ].filter((m) => m.status === 'active') as any,
      },
    }

    return jsonResponse(summary)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load dashboard', 500)
  }
}
