import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { writeGschAuditLog } from '@/lib/gsch/auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)

    const { data, error } = await supabase
      .from('gsch_verifications')
      .select(
        `
        *,
        organization:gsch_organizations!organization_id(
          id, name, org_type, country, verification_status, verification_badge, logo_url
        )
      `
      )
      .eq('id', id)
      .maybeSingle()

    if (error) return errorResponse(error.message, 400)
    if (!data) return errorResponse('Verification not found', 404)
    if (data.submitted_by !== user.id) {
      // org members can also read via RLS; allow if select succeeded
    }

    return jsonResponse(data)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load verification', 500)
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json()

    const { data: existing, error: loadError } = await supabase
      .from('gsch_verifications')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (loadError) return errorResponse(loadError.message, 400)
    if (!existing) return errorResponse('Verification not found', 404)

    if (existing.submitted_by !== user.id) {
      return forbiddenResponse('Only the submitter can update this verification.')
    }

    if (!['draft', 'additional_info_required'].includes(existing.status)) {
      return forbiddenResponse('This verification can no longer be edited.')
    }

    const allowed: Record<string, unknown> = {}
    if (body.document_urls !== undefined) {
      allowed.document_urls = Array.isArray(body.document_urls) ? body.document_urls : []
    }
    if (body.notes !== undefined) {
      allowed.notes = body.notes?.trim() || null
    }

    const submit = body.submit === true || body.status === 'submitted'
    if (submit) {
      allowed.status = 'submitted'
    } else if (body.status === 'draft' && existing.status === 'draft') {
      allowed.status = 'draft'
    }

    if (Object.keys(allowed).length === 0) {
      return errorResponse('No valid updates provided.', 400)
    }

    const { data, error } = await supabase
      .from('gsch_verifications')
      .update(allowed)
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

    if (submit) {
      await supabase
        .from('gsch_organizations')
        .update({ verification_status: 'submitted' })
        .eq('id', existing.organization_id)

      await writeGschAuditLog(supabase, {
        actor_id: user.id,
        action: 'verification_submitted',
        entity_type: 'gsch_verification',
        entity_id: id,
        metadata: { organization_id: existing.organization_id },
      })
    } else {
      await writeGschAuditLog(supabase, {
        actor_id: user.id,
        action: 'verification_updated',
        entity_type: 'gsch_verification',
        entity_id: id,
        metadata: { fields: Object.keys(allowed) },
      })
    }

    return jsonResponse(data)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to update verification', 500)
  }
}
