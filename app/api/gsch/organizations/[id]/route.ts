import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import {
  getOrgMembership,
  isPlatformGschAdmin,
  requireOrgRole,
  writeGschAuditLog,
} from '@/lib/gsch/auth'
import type { GschOrgType } from '@/shared/types/gsch'

type Params = { params: Promise<{ id: string }> }

const ORG_TYPES: GschOrgType[] = [
  'municipality',
  'government_agency',
  'business',
  'startup',
  'investor',
  'chamber_of_commerce',
  'university',
  'ngo',
  'tourism_board',
  'citizen',
]

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)

    const { data: org, error } = await supabase
      .from('gsch_organizations')
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

    const isAdmin = await isPlatformGschAdmin(supabase, user.id)
    const allowed: Record<string, unknown> = {}

    for (const key of [
      'name',
      'country',
      'state_province',
      'city',
      'website',
      'official_email',
      'description',
      'logo_url',
      'areas_of_interest',
    ] as const) {
      if (body[key] !== undefined) allowed[key] = body[key]
    }

    if (body.org_type !== undefined) {
      if (!ORG_TYPES.includes(body.org_type)) {
        return errorResponse('Invalid org_type', 400)
      }
      allowed.org_type = body.org_type
    }

    // Verification fields are owned by the verification + admin workflows only.
    // Org profile PATCH never lets members self-verify or assign badges.
    if (
      !isAdmin &&
      (body.verification_status !== undefined ||
        body.verification_badge !== undefined ||
        body.verified_by !== undefined ||
        body.verified_at !== undefined)
    ) {
      return forbiddenResponse(
        'Use the verification workflow. Only platform admins can change verification status.'
      )
    }

    if (isAdmin) {
      if (body.verification_status !== undefined) {
        if (
          ![
            'draft',
            'submitted',
            'under_review',
            'additional_info_required',
            'verified',
            'rejected',
          ].includes(body.verification_status)
        ) {
          return errorResponse('Invalid verification_status', 400)
        }
        allowed.verification_status = body.verification_status
      }
      if (body.verification_badge !== undefined) {
        allowed.verification_badge = body.verification_badge
      }
    }

    if (Object.keys(allowed).length === 0) {
      return errorResponse('No valid updates provided.', 400)
    }

    const { data, error } = await supabase
      .from('gsch_organizations')
      .update(allowed)
      .eq('id', id)
      .select('*')
      .single()

    if (error) return errorResponse(error.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: 'organization_updated',
      entity_type: 'gsch_organization',
      entity_id: id,
      metadata: { fields: Object.keys(allowed) },
    })

    return jsonResponse(data)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to update organization', 500)
  }
}
