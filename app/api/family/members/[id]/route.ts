import { NextRequest } from 'next/server'
import { createServiceClient, getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  FAMILY_CHILD_TO_TEEN_NOTICE_AGE,
  FamilyAuthError,
  ageFromBirthday,
  promoteChildToTeen,
  requireParentOfMember,
} from '@/lib/family'
import type { FamilyMemberRole } from '@/shared/types/family'

/**
 * Parent updates a member role (currently: Child → Teen when age >= 16).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)
    const { target } = await requireParentOfMember(supabase, user.id, id)
    const body = await request.json().catch(() => ({}))
    const nextRole = body?.role as FamilyMemberRole | undefined

    if (nextRole !== 'teen') {
      return errorResponse('Only changing a Child to Teen is supported here', 400)
    }

    if (target.role !== 'child' || target.status !== 'active') {
      return errorResponse('Only an active Child can be changed to Teen', 400)
    }

    const service = createServiceClient()
    const { data: profile } = await service
      .from('profiles')
      .select('birthday')
      .eq('id', target.user_id)
      .maybeSingle()

    const age = ageFromBirthday(profile?.birthday)
    if (age === null || age < FAMILY_CHILD_TO_TEEN_NOTICE_AGE) {
      return errorResponse(
        `Child must be at least ${FAMILY_CHILD_TO_TEEN_NOTICE_AGE} years old to change to Teen`,
        400
      )
    }

    await promoteChildToTeen(service, id)

    const { data: updated, error } = await service
      .from('family_members')
      .select(
        'id, family_id, user_id, role, relationship, status, parental_oversight_enabled, joined_at, created_at, updated_at'
      )
      .eq('id', id)
      .single()

    if (error) return errorResponse(error.message, 400)
    return jsonResponse(updated)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update member'
    if (message === 'Unauthorized' || message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    if (error instanceof FamilyAuthError) {
      return errorResponse(error.message, error.status)
    }
    return errorResponse(message, 500)
  }
}
