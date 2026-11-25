import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { errorResponse, jsonResponse, unauthorizedResponse } from '@/lib/api-utils'
import { writeGschAuditLog } from '@/lib/gsch/auth'
import type { GschOrgType } from '@/shared/types/gsch'

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

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)

    const { data: memberships, error: memError } = await supabase
      .from('gsch_memberships')
      .select('organization_id, role, status')
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (memError) return errorResponse(memError.message, 400)

    const orgIds = (memberships || []).map((m) => m.organization_id)
    if (orgIds.length === 0) return jsonResponse([])

    const { data, error } = await supabase
      .from('gsch_organizations')
      .select('*')
      .in('id', orgIds)
      .order('created_at', { ascending: false })

    if (error) return errorResponse(error.message, 400)

    const roleByOrg = new Map(
      (memberships || []).map((m) => [m.organization_id, m.role])
    )
    const enriched = (data || []).map((org) => ({
      ...org,
      my_role: roleByOrg.get(org.id) || null,
    }))

    return jsonResponse(enriched)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load organizations', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json()

    if (!body.name?.trim()) return errorResponse('name is required', 400)
    if (!body.country?.trim()) return errorResponse('country is required', 400)
    if (!body.org_type || !ORG_TYPES.includes(body.org_type)) {
      return errorResponse('Valid org_type is required', 400)
    }

    const { data: org, error } = await supabase
      .from('gsch_organizations')
      .insert({
        name: String(body.name).trim(),
        org_type: body.org_type,
        country: String(body.country).trim(),
        state_province: body.state_province?.trim() || null,
        city: body.city?.trim() || null,
        website: body.website?.trim() || null,
        official_email: body.official_email?.trim() || null,
        description: body.description?.trim() || null,
        logo_url: body.logo_url || null,
        areas_of_interest: Array.isArray(body.areas_of_interest)
          ? body.areas_of_interest
          : [],
        created_by: user.id,
        verification_status: 'draft',
        verification_badge: null,
        verified_by: null,
        verified_at: null,
      })
      .select('*')
      .single()

    if (error) return errorResponse(error.message, 400)

    const { error: memberError } = await supabase.from('gsch_memberships').insert({
      organization_id: org.id,
      user_id: user.id,
      role: 'owner',
      status: 'active',
    })

    if (memberError) return errorResponse(memberError.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: 'organization_created',
      entity_type: 'gsch_organization',
      entity_id: org.id,
      metadata: { name: org.name, org_type: org.org_type },
    })

    return jsonResponse({ ...org, my_role: 'owner' }, 201)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to create organization', 500)
  }
}
