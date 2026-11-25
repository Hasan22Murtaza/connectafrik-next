import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { isPlatformGschAdmin } from '@/lib/gsch/auth'

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    if (!(await isPlatformGschAdmin(supabase, user.id))) {
      return forbiddenResponse('Platform admin access required.')
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || ''
    const page = Math.max(parseInt(searchParams.get('page') || '0', 10) || 0, 0)
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1),
      50
    )
    const from = page * limit
    const to = from + limit - 1

    let query = supabase
      .from('gsch_verifications')
      .select(
        `
        *,
        organization:gsch_organizations!organization_id(
          id, name, org_type, country, city, logo_url,
          verification_status, verification_badge, official_email
        )
      `
      )
      .order('created_at', { ascending: false })
      .range(from, to)

    if (status) {
      query = query.eq('status', status)
    } else {
      query = query.in('status', [
        'submitted',
        'under_review',
        'additional_info_required',
      ])
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
    return errorResponse(error?.message || 'Failed to load verification queue', 500)
  }
}
