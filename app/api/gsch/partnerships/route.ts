import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { errorResponse, jsonResponse, unauthorizedResponse } from '@/lib/api-utils'

const PARTNERSHIP_SELECT = `
  id, request_id, title, partnership_type,
  organization_a_id, organization_b_id, city_a_id, city_b_id,
  objectives, status, started_at, ends_at, created_by, created_at, updated_at,
  organization_a:gsch_organizations!organization_a_id(
    id, name, country, logo_url, verification_status
  ),
  organization_b:gsch_organizations!organization_b_id(
    id, name, country, logo_url, verification_status
  ),
  city_a:gsch_cities!city_a_id(id, name, country, logo_url),
  city_b:gsch_cities!city_b_id(id, name, country, logo_url)
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
    const mine = searchParams.get('mine') !== '0'

    const from = page * limit
    const to = from + limit - 1

    let query = supabase
      .from('gsch_partnerships')
      .select(PARTNERSHIP_SELECT)
      .order('started_at', { ascending: false })
      .range(from, to)

    if (status) query = query.eq('status', status)

    if (mine) {
      const { data: memberships } = await supabase
        .from('gsch_memberships')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
      const orgIds = (memberships || []).map((m) => m.organization_id)
      if (orgIds.length === 0) {
        return jsonResponse({ data: [], page, pageSize: limit, hasMore: false })
      }
      query = query.or(
        `organization_a_id.in.(${orgIds.join(',')}),organization_b_id.in.(${orgIds.join(',')})`
      )
    } else {
      query = query.eq('status', 'active')
    }

    const { data, error } = await query
    if (error) return errorResponse(error.message, 400)

    return jsonResponse({
      data: data || [],
      page,
      pageSize: limit,
      hasMore: (data || []).length === limit,
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load partnerships', 500)
  }
}
