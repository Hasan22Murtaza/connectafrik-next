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
  getOrgMembership,
  requireOrgRole,
  writeYouthAuditLog,
} from '@/lib/youth-leadership/auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)
    const access = await checkYouthLeadershipAccess(supabase, user.id)
    if (!access.allowed) {
      return errorResponse(access.message || 'Access restricted', 403, {
        code: access.code,
      })
    }

    const { data: org, error } = await supabase
      .from('youth_organizations')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) return errorResponse(error.message, 400)
    if (!org) return errorResponse('Organization not found', 404)

    const membership = await getOrgMembership(supabase, id, user.id)

    return jsonResponse({
      ...org,
      my_role: membership?.role || null,
      my_membership: membership || null,
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load organization', 500)
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json()

    const authz = await requireOrgRole(supabase, id, user.id, 'admin')
    if (!authz.ok) return forbiddenResponse(authz.message)

    const allowed: Record<string, unknown> = {}
    for (const key of [
      'name',
      'description',
      'logo_url',
      'website',
      'country',
      'region',
    ] as const) {
      if (body[key] !== undefined) allowed[key] = body[key]
    }

    if (Object.keys(allowed).length === 0) {
      return errorResponse('No valid updates provided.', 400)
    }

    const { data, error } = await supabase
      .from('youth_organizations')
      .update(allowed)
      .eq('id', id)
      .select('*')
      .single()

    if (error) return errorResponse(error.message, 400)

    await writeYouthAuditLog(supabase, {
      actor_id: user.id,
      action: 'organization_updated',
      entity_type: 'youth_organization',
      entity_id: id,
      metadata: { fields: Object.keys(allowed) },
    })

    return jsonResponse(data)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to update organization', 500)
  }
}
