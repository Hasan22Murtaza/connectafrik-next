import { NextRequest } from 'next/server'
import { createServiceClient, getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { isPlatformGschAdmin, writeGschAuditLog } from '@/lib/gsch/auth'
import type { GschVerificationBadge, GschVerificationStatus } from '@/shared/types/gsch'

type Params = { params: Promise<{ id: string }> }

const ADMIN_STATUSES: GschVerificationStatus[] = [
  'under_review',
  'additional_info_required',
  'verified',
  'rejected',
]

const BADGES: GschVerificationBadge[] = [
  'verified_city',
  'verified_business',
  'verified_institution',
  'verified_government',
  'strategic_global_partner',
]

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)

    if (!(await isPlatformGschAdmin(supabase, user.id))) {
      return forbiddenResponse('Platform admin access required.')
    }

    const body = await request.json()
    const status = body.status as GschVerificationStatus
    if (!ADMIN_STATUSES.includes(status)) {
      return errorResponse(
        'status must be under_review, additional_info_required, verified, or rejected',
        400
      )
    }

    if (status === 'verified') {
      if (!body.verification_badge || !BADGES.includes(body.verification_badge)) {
        return errorResponse('verification_badge is required when verifying', 400)
      }
    }

    const { data: existing, error: loadError } = await supabase
      .from('gsch_verifications')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (loadError) return errorResponse(loadError.message, 400)
    if (!existing) return errorResponse('Verification not found', 404)

    // Service client ensures badge/status updates bypass protect trigger only for platform admin path
    const adminClient = createServiceClient()
    const now = new Date().toISOString()

    const { data: verification, error } = await adminClient
      .from('gsch_verifications')
      .update({
        status,
        reviewer_id: user.id,
        reviewed_at: now,
        admin_notes: body.admin_notes?.trim() || null,
      })
      .eq('id', id)
      .select(
        `
        *,
        organization:gsch_organizations!organization_id(
          id, name, org_type, country, verification_status, verification_badge, logo_url
        )
      `
      )
      .single()

    if (error) return errorResponse(error.message, 400)

    const orgUpdate: Record<string, unknown> = {
      verification_status: status,
    }

    if (status === 'verified') {
      orgUpdate.verification_badge = body.verification_badge
      orgUpdate.verified_by = user.id
      orgUpdate.verified_at = now
      orgUpdate.rejection_reason = null
      orgUpdate.additional_info_notes = null
    } else if (status === 'rejected') {
      orgUpdate.rejection_reason = body.rejection_reason?.trim() || body.admin_notes?.trim() || null
      orgUpdate.verification_badge = null
      orgUpdate.verified_by = null
      orgUpdate.verified_at = null
    } else if (status === 'additional_info_required') {
      orgUpdate.additional_info_notes =
        body.additional_info_notes?.trim() || body.admin_notes?.trim() || null
    }

    const { error: orgError } = await adminClient
      .from('gsch_organizations')
      .update(orgUpdate)
      .eq('id', existing.organization_id)

    if (orgError) return errorResponse(orgError.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: `verification_${status}`,
      entity_type: 'gsch_verification',
      entity_id: id,
      metadata: {
        organization_id: existing.organization_id,
        status,
        verification_badge: body.verification_badge || null,
      },
    })

    return jsonResponse(verification)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to update verification', 500)
  }
}
