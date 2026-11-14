import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import {
  checkYouthLeadershipAccess,
  getUserAge,
  isAgeEligible,
  requireOrgRole,
} from '@/lib/youth-leadership/auth'
import { notifyYouthUser } from '@/lib/youth-leadership/notify'
import { getActiveMembership, isManagedRole } from '@/lib/family/auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)

    const { data: program } = await supabase
      .from('youth_programs')
      .select('id, organization_id')
      .eq('id', id)
      .maybeSingle()
    if (!program) return errorResponse('Program not found', 404)

    const authz = await requireOrgRole(
      supabase,
      program.organization_id,
      user.id,
      'coordinator'
    )
    if (!authz.ok) return forbiddenResponse(authz.message)

    const status = new URL(request.url).searchParams.get('status')
    let query = supabase
      .from('youth_program_applications')
      .select(
        `
        id, program_id, user_id, status, guardian_approval_status, submitted_at, created_at,
        applicant:profiles!user_id(id, username, full_name, avatar_url)
      `
      )
      .eq('program_id', id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) return errorResponse(error.message, 400)
    return jsonResponse(data || [])
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load applications', 500)
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: programId } = await params
    const { user, supabase } = await getAuthenticatedUser(request)
    const access = await checkYouthLeadershipAccess(supabase, user.id)
    if (!access.allowed) {
      return errorResponse(access.message || 'Access restricted', 403, {
        code: access.code,
      })
    }

    const body = await request.json().catch(() => ({}))
    const submit = body.submit !== false

    const { data: program } = await supabase
      .from('youth_programs')
      .select(
        `id, organization_id, title, status, application_deadline, minimum_age, maximum_age,
         capacity, seats_taken, requires_guardian_approval, application_questions`
      )
      .eq('id', programId)
      .maybeSingle()

    if (!program) return errorResponse('Program not found', 404)
    if (program.status !== 'published') {
      return errorResponse('This program is not accepting applications.', 400)
    }
    if (
      program.application_deadline &&
      new Date(program.application_deadline).getTime() < Date.now()
    ) {
      return errorResponse('The application deadline has passed.', 400)
    }

    const age = await getUserAge(supabase, user.id)
    if (age == null && (program.minimum_age != null || program.maximum_age != null)) {
      return errorResponse(
        'Add your birthday in profile settings to apply for age-restricted programs.',
        400
      )
    }
    if (!isAgeEligible(age, program.minimum_age, program.maximum_age)) {
      return errorResponse('You are not eligible for this program based on age.', 403, {
        code: 'AGE_INELIGIBLE',
      })
    }

    if (program.capacity != null && program.seats_taken >= program.capacity) {
      return errorResponse('This program has no available seats.', 400)
    }

    const membership = await getActiveMembership(supabase, user.id)
    const needsGuardian =
      program.requires_guardian_approval ||
      (membership && isManagedRole(membership.role) && (age == null || age < 18))

    const questions = Array.isArray(program.application_questions)
      ? program.application_questions
      : []
    const answers = (body.application_data || {}) as Record<string, unknown>
    if (submit) {
      for (const q of questions) {
        if (q?.required && !String(answers[q.id] ?? '').trim()) {
          return errorResponse(`Missing required answer: ${q.prompt || q.id}`, 400)
        }
      }
    }

    const now = new Date().toISOString()
    const row = {
      program_id: programId,
      user_id: user.id,
      status: submit ? 'submitted' : 'draft',
      application_data: answers,
      guardian_approval_status: needsGuardian
        ? 'pending'
        : 'not_required',
      submitted_at: submit ? now : null,
    }

    const { data: existing } = await supabase
      .from('youth_program_applications')
      .select('id, status')
      .eq('program_id', programId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing && !['draft', 'withdrawn'].includes(existing.status)) {
      return errorResponse('You already have an application for this program.', 400)
    }

    let result
    if (existing) {
      const { data, error } = await supabase
        .from('youth_program_applications')
        .update(row)
        .eq('id', existing.id)
        .select('*')
        .single()
      if (error) return errorResponse(error.message, 400)
      result = data
    } else {
      const { data, error } = await supabase
        .from('youth_program_applications')
        .insert(row)
        .select('*')
        .single()
      if (error) return errorResponse(error.message, 400)
      result = data
    }

    if (submit) {
      const { data: coordinators } = await supabase
        .from('youth_organization_members')
        .select('user_id')
        .eq('organization_id', program.organization_id)
        .eq('status', 'active')
        .in('role', ['admin', 'coordinator'])

      const notifyJobs: Promise<unknown>[] = (coordinators || [])
        .filter((c) => c.user_id !== user.id)
        .map((c) =>
          notifyYouthUser({
            user_id: c.user_id,
            type: 'youth_program_application',
            title: 'New program application',
            message: `A participant applied to ${program.title}.`,
            data: {
              program_id: programId,
              application_id: result.id,
              href: `/youth-leadership/organization?program=${programId}`,
            },
          })
        )

      if (needsGuardian && membership) {
        const { data: parents } = await supabase
          .from('family_members')
          .select('user_id')
          .eq('family_id', membership.family_id)
          .eq('role', 'parent')
          .eq('status', 'active')
        for (const p of parents || []) {
          notifyJobs.push(
            notifyYouthUser({
              user_id: p.user_id,
              type: 'youth_guardian_approval',
              title: 'Youth program approval needed',
              message: `Please review a Youth Leadership program application.`,
              data: {
                program_id: programId,
                application_id: result.id,
                child_user_id: user.id,
                href: '/youth-leadership/guardian',
              },
            })
          )
        }
      }

      await Promise.all(notifyJobs)
    }

    return jsonResponse(result, existing ? 200 : 201)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to submit application', 500)
  }
}
