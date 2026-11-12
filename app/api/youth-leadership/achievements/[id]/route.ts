import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import {
  isPlatformYouthAdmin,
  requireOrgRole,
} from '@/lib/youth-leadership/auth'
import { notifyYouthUser } from '@/lib/youth-leadership/notify'
import type { YouthAchievementVerificationStatus } from '@/shared/types/youthLeadership'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json().catch(() => ({}))

    const { data: existing } = await supabase
      .from('youth_achievements')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (!existing) return errorResponse('Achievement not found', 404)

    const isOwner = existing.user_id === user.id
    const isPlatformAdmin = await isPlatformYouthAdmin(supabase, user.id)
    let isOrgCoordinator = false
    if (existing.organization_id) {
      const authz = await requireOrgRole(
        supabase,
        existing.organization_id,
        user.id,
        'coordinator'
      )
      isOrgCoordinator = authz.ok
    }

    if (!isOwner && !isOrgCoordinator && !isPlatformAdmin) {
      return forbiddenResponse('Not authorized to update this achievement.')
    }

    const updates: Record<string, unknown> = {}
    const nextVerification = body.verification_status as
      | YouthAchievementVerificationStatus
      | undefined

    if (nextVerification === 'verified') {
      if (!isOrgCoordinator && !isPlatformAdmin) {
        return forbiddenResponse(
          'Only organization coordinators or platform admins can verify achievements.'
        )
      }
      updates.verification_status = 'verified'
      updates.verified_by = user.id
      updates.verified_at = new Date().toISOString()
    } else if (nextVerification === 'rejected') {
      if (!isOrgCoordinator && !isPlatformAdmin) {
        return forbiddenResponse('Not authorized to reject achievements.')
      }
      updates.verification_status = 'rejected'
      updates.verified_by = user.id
      updates.verified_at = new Date().toISOString()
    } else if (nextVerification === 'pending' && (isOrgCoordinator || isPlatformAdmin)) {
      updates.verification_status = 'pending'
      updates.verified_by = null
      updates.verified_at = null
    } else if (nextVerification) {
      return forbiddenResponse('Participants cannot set verification_status to verified.')
    }

    // Owners can edit content while pending
    if (isOwner && existing.verification_status === 'pending') {
      for (const key of [
        'title',
        'description',
        'skills',
        'achievement_type',
        'badge_slug',
      ] as const) {
        if (body[key] !== undefined) updates[key] = body[key]
      }
    }

    // Coordinators/admins can set certificate_url and content
    if (isOrgCoordinator || isPlatformAdmin) {
      for (const key of [
        'title',
        'description',
        'skills',
        'achievement_type',
        'badge_slug',
        'certificate_url',
        'program_id',
        'project_id',
      ] as const) {
        if (body[key] !== undefined) updates[key] = body[key]
      }
    }

    if (Object.keys(updates).length === 0) {
      return errorResponse('No valid updates provided.', 400)
    }

    const { data, error } = await supabase
      .from('youth_achievements')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (error) return errorResponse(error.message, 400)

    if (
      updates.verification_status === 'verified' &&
      existing.verification_status !== 'verified'
    ) {
      await notifyYouthUser({
        user_id: existing.user_id,
        type: 'youth_achievement_verified',
        title: 'Achievement verified',
        message: `Your achievement "${existing.title}" was verified.`,
        data: {
          achievement_id: id,
          href: '/youth-leadership/achievements',
        },
      })
    }

    const certificateSet =
      typeof updates.certificate_url === 'string' &&
      updates.certificate_url &&
      updates.certificate_url !== existing.certificate_url

    if (certificateSet) {
      await notifyYouthUser({
        user_id: existing.user_id,
        type: 'youth_certificate_issued',
        title: 'Certificate issued',
        message: `A certificate was issued for "${existing.title}".`,
        data: {
          achievement_id: id,
          certificate_url: updates.certificate_url,
          href: '/youth-leadership/achievements',
        },
      })
    }

    return jsonResponse(data)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to update achievement', 500)
  }
}
