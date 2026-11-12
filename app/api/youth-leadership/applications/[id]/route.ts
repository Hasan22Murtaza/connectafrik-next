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
  requireOrgRole,
} from '@/lib/youth-leadership/auth'
import { notifyYouthUser } from '@/lib/youth-leadership/notify'
import { getActiveMembership, isManagedRole } from '@/lib/family/auth'
import {
  COORDINATOR_ONLY_APPLICATION_STATUSES,
  type YouthApplicationStatus,
  type YouthGuardianApprovalStatus,
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

    const { data: application } = await supabase
      .from('youth_program_applications')
      .select(
        `
        *,
        program:youth_programs!program_id(id, title, organization_id, seats_taken, capacity)
      `
      )
      .eq('id', id)
      .maybeSingle()

    if (!application) return errorResponse('Application not found', 404)

    const program = application.program as {
      id: string
      title: string
      organization_id: string
      seats_taken: number
      capacity: number | null
    } | null
    if (!program) return errorResponse('Program not found', 404)

    const isParticipant = application.user_id === user.id
    const authz = await requireOrgRole(
      supabase,
      program.organization_id,
      user.id,
      'coordinator'
    )
    const isCoordinator = authz.ok
    const isParent = !isParticipant
      ? await isParentOfYouth(supabase, user.id, application.user_id)
      : false

    if (!isParticipant && !isCoordinator && !isParent) {
      return forbiddenResponse('Not authorized to update this application.')
    }

    // Parents approving for children should not be blocked by the child's feature gate.
    if (!isParent) {
      const access = await checkYouthLeadershipAccess(supabase, user.id)
      if (!access.allowed) {
        return errorResponse(access.message || 'Access restricted', 403, {
          code: access.code,
        })
      }
    }

    const updates: Record<string, unknown> = {}
    const nextStatus = body.status as YouthApplicationStatus | undefined
    const nextGuardian = body.guardian_approval_status as
      | YouthGuardianApprovalStatus
      | undefined

    // Parent: guardian approval only
    if (isParent && nextGuardian) {
      if (!['approved', 'rejected'].includes(nextGuardian)) {
        return errorResponse('guardian_approval_status must be approved or rejected', 400)
      }
      updates.guardian_approval_status = nextGuardian
      updates.guardian_reviewed_by = user.id
      updates.guardian_reviewed_at = new Date().toISOString()
    }

    // Participant updates
    if (isParticipant && !isCoordinator) {
      if (nextStatus) {
        if (COORDINATOR_ONLY_APPLICATION_STATUSES.includes(nextStatus)) {
          return forbiddenResponse('Participants cannot set coordinator statuses.')
        }
        if (nextStatus !== 'withdrawn') {
          return forbiddenResponse('Participants may only set status to withdrawn.')
        }
        updates.status = 'withdrawn'
      }
      if (body.application_data !== undefined) {
        if (application.status !== 'draft') {
          return errorResponse('Only draft applications can update application_data.', 400)
        }
        updates.application_data = body.application_data
      }
      if (!isParent && nextGuardian) {
        return forbiddenResponse('Only a parent can set guardian approval.')
      }
    }

    // Coordinator updates
    if (isCoordinator && nextStatus) {
      if (COORDINATOR_ONLY_APPLICATION_STATUSES.includes(nextStatus)) {
        updates.status = nextStatus
        updates.reviewed_by = user.id
        updates.reviewed_at = new Date().toISOString()
        if (body.review_notes !== undefined) {
          updates.review_notes = body.review_notes
        }
      } else if (isParticipant && nextStatus === 'withdrawn') {
        updates.status = 'withdrawn'
      } else {
        return errorResponse(
          'Coordinators may set under_review, accepted, waitlisted, rejected, or completed.',
          400
        )
      }
    }

    if (Object.keys(updates).length === 0) {
      return errorResponse('No valid updates provided.', 400)
    }

    const { data: updated, error } = await supabase
      .from('youth_program_applications')
      .update(updates)
      .eq('id', id)
      .select(
        `
        *,
        program:youth_programs!program_id(
          id, title, status, organization_id,
          organization:youth_organizations!organization_id(id, name, logo_url)
        )
      `
      )
      .single()

    if (error) return errorResponse(error.message, 400)

    const statusChanged =
      nextStatus &&
      nextStatus !== application.status &&
      updates.status === nextStatus

    if (statusChanged && nextStatus === 'accepted') {
      const { data: existingEnrollment } = await supabase
        .from('youth_program_enrollments')
        .select('id')
        .eq('program_id', program.id)
        .eq('user_id', application.user_id)
        .maybeSingle()

      if (!existingEnrollment) {
        const { error: enrollError } = await supabase
          .from('youth_program_enrollments')
          .insert({
            program_id: program.id,
            user_id: application.user_id,
            application_id: application.id,
            status: 'active',
          })
        if (enrollError) return errorResponse(enrollError.message, 400)

        await supabase
          .from('youth_programs')
          .update({ seats_taken: (program.seats_taken || 0) + 1 })
          .eq('id', program.id)
      }

      await notifyYouthUser({
        user_id: application.user_id,
        type: 'youth_program_accepted',
        title: 'Program application accepted',
        message: `You have been accepted into ${program.title}.`,
        data: {
          program_id: program.id,
          application_id: id,
          href: `/youth-leadership/programs/${program.id}`,
        },
      })
    } else if (statusChanged && nextStatus) {
      await notifyYouthUser({
        user_id: application.user_id,
        type: 'youth_application_status',
        title: 'Application status updated',
        message: `Your application for ${program.title} is now ${nextStatus.replace(/_/g, ' ')}.`,
        data: {
          program_id: program.id,
          application_id: id,
          status: nextStatus,
          href: '/youth-leadership/applications',
        },
      })
    }

    return jsonResponse(updated)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to update application', 500)
  }
}
