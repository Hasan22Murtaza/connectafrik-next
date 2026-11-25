import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { requireOrgRole, writeGschAuditLog } from '@/lib/gsch/auth'

export async function GET(request: NextRequest) {
  try {
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
      .eq('submitted_by', user.id)
      .order('created_at', { ascending: false })

    if (error) return errorResponse(error.message, 400)
    return jsonResponse(data || [])
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load verifications', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json()

    const organizationId = body.organization_id
    if (!organizationId) return errorResponse('organization_id is required', 400)

    const authz = await requireOrgRole(supabase, organizationId, user.id, 'representative')
    if (!authz.ok) return forbiddenResponse(authz.message)

    const submit = body.submit === true || body.status === 'submitted'
    const status = submit ? 'submitted' : 'draft'
    const documentUrls = Array.isArray(body.document_urls) ? body.document_urls : []

    const { data, error } = await supabase
      .from('gsch_verifications')
      .insert({
        organization_id: organizationId,
        submitted_by: user.id,
        status,
        document_urls: documentUrls,
        notes: body.notes?.trim() || null,
      })
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
        .eq('id', organizationId)
    }

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: submit ? 'verification_submitted' : 'verification_drafted',
      entity_type: 'gsch_verification',
      entity_id: data.id,
      metadata: { organization_id: organizationId, status },
    })

    return jsonResponse(data, 201)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to create verification', 500)
  }
}
