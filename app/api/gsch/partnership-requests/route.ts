import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { requireOrgRole, writeGschAuditLog } from '@/lib/gsch/auth'
import type { GschPartnershipType } from '@/shared/types/gsch'

const PARTNERSHIP_TYPES: GschPartnershipType[] = [
  'sister_city',
  'economic',
  'tourism',
  'education',
  'climate',
  'infrastructure',
  'innovation',
  'cultural',
  'other',
]

const REQUEST_SELECT = `
  id, requesting_organization_id, target_organization_id,
  requesting_city_id, target_city_id, title, partnership_type,
  objectives, proposed_duration, message, status, created_by,
  responded_by, responded_at, response_notes, partnership_id,
  created_at, updated_at,
  requesting_organization:gsch_organizations!requesting_organization_id(
    id, name, country, logo_url, verification_status
  ),
  target_organization:gsch_organizations!target_organization_id(
    id, name, country, logo_url, verification_status
  ),
  requesting_city:gsch_cities!requesting_city_id(
    id, name, country, logo_url
  ),
  target_city:gsch_cities!target_city_id(
    id, name, country, logo_url
  )
`

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const page = Math.max(parseInt(searchParams.get('page') || '0', 10) || 0, 0)
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1),
      50
    )
    const status = searchParams.get('status')?.trim() || ''
    const direction = searchParams.get('direction')?.trim() || '' // sent | received | ''

    const { data: memberships } = await supabase
      .from('gsch_memberships')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('status', 'active')

    const orgIds = (memberships || []).map((m) => m.organization_id)

    // Also resolve orgs for cities the user can manage (target via city)
    const { data: managedCities } = await supabase
      .from('gsch_cities')
      .select('id, organization_id')
      .or(
        orgIds.length > 0
          ? `created_by.eq.${user.id},organization_id.in.(${orgIds.join(',')})`
          : `created_by.eq.${user.id}`
      )

    const managedCityIds = (managedCities || []).map((c) => c.id)

    let query = supabase
      .from('gsch_partnership_requests')
      .select(REQUEST_SELECT)
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)

    if (direction === 'sent') {
      if (orgIds.length === 0) {
        return jsonResponse({ data: [], page, pageSize: limit, hasMore: false })
      }
      query = query.in('requesting_organization_id', orgIds)
    } else if (direction === 'received') {
      const filters: string[] = []
      if (orgIds.length > 0) {
        filters.push(`target_organization_id.in.(${orgIds.join(',')})`)
      }
      if (managedCityIds.length > 0) {
        filters.push(`target_city_id.in.(${managedCityIds.join(',')})`)
      }
      if (filters.length === 0) {
        return jsonResponse({ data: [], page, pageSize: limit, hasMore: false })
      }
      query = query.or(filters.join(','))
    } else {
      const filters: string[] = [`created_by.eq.${user.id}`]
      if (orgIds.length > 0) {
        filters.push(`requesting_organization_id.in.(${orgIds.join(',')})`)
        filters.push(`target_organization_id.in.(${orgIds.join(',')})`)
      }
      if (managedCityIds.length > 0) {
        filters.push(`target_city_id.in.(${managedCityIds.join(',')})`)
      }
      query = query.or(filters.join(','))
    }

    const from = page * limit
    const to = from + limit - 1
    const { data, error } = await query.range(from, to)
    if (error) return errorResponse(error.message, 400)

    const orgSet = new Set(orgIds)
    const citySet = new Set(managedCityIds)
    const enriched = (data || []).map((row: any) => {
      const isSent =
        orgSet.has(row.requesting_organization_id) || row.created_by === user.id
      const isReceived =
        (row.target_organization_id && orgSet.has(row.target_organization_id)) ||
        (row.target_city_id && citySet.has(row.target_city_id))
      return {
        ...row,
        direction: isReceived && !isSent ? 'received' : isSent ? 'sent' : 'received',
      }
    })

    return jsonResponse({
      data: enriched,
      page,
      pageSize: limit,
      hasMore: (data || []).length === limit,
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load partnership requests', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json()

    const requestingOrganizationId = body.requesting_organization_id
    if (!requestingOrganizationId) {
      return errorResponse('requesting_organization_id is required', 400)
    }
    if (!body.title?.trim()) return errorResponse('title is required', 400)

    const partnershipType = body.partnership_type as GschPartnershipType
    if (!PARTNERSHIP_TYPES.includes(partnershipType)) {
      return errorResponse('Invalid partnership_type', 400)
    }

    const targetOrganizationId = body.target_organization_id || null
    const targetCityId = body.target_city_id || null
    if (!targetOrganizationId && !targetCityId) {
      return errorResponse('target_organization_id or target_city_id is required', 400)
    }

    if (targetOrganizationId && targetOrganizationId === requestingOrganizationId) {
      return errorResponse('Cannot partner with your own organization', 400)
    }

    const authz = await requireOrgRole(
      supabase,
      requestingOrganizationId,
      user.id,
      'representative'
    )
    if (!authz.ok) return forbiddenResponse(authz.message)

    // Resolve target org from city if needed
    let resolvedTargetOrg = targetOrganizationId
    if (!resolvedTargetOrg && targetCityId) {
      const { data: city } = await supabase
        .from('gsch_cities')
        .select('id, organization_id')
        .eq('id', targetCityId)
        .maybeSingle()
      if (!city) return errorResponse('Target city not found', 404)
      resolvedTargetOrg = city.organization_id || null
    }

    if (resolvedTargetOrg && resolvedTargetOrg === requestingOrganizationId) {
      return errorResponse('Cannot partner with your own organization', 400)
    }

    const status =
      body.status === 'draft' ? 'draft' : body.status === 'pending' ? 'pending' : 'pending'

    const { data, error } = await supabase
      .from('gsch_partnership_requests')
      .insert({
        requesting_organization_id: requestingOrganizationId,
        target_organization_id: resolvedTargetOrg,
        requesting_city_id: body.requesting_city_id || null,
        target_city_id: targetCityId,
        title: String(body.title).trim(),
        partnership_type: partnershipType,
        objectives: body.objectives?.trim() || null,
        proposed_duration: body.proposed_duration?.trim() || null,
        message: body.message?.trim() || null,
        status,
        created_by: user.id,
      })
      .select(REQUEST_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: 'partnership_request_created',
      entity_type: 'gsch_partnership_request',
      entity_id: data.id,
      metadata: {
        status,
        partnership_type: partnershipType,
        target_organization_id: resolvedTargetOrg,
        target_city_id: targetCityId,
      },
    })

    return jsonResponse({ ...data, direction: 'sent' }, 201)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to create partnership request', 500)
  }
}
