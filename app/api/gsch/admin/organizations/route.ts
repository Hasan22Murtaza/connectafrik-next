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
      return forbiddenResponse('Platform admin required')
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(parseInt(searchParams.get('page') || '0', 10) || 0, 0)
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1),
      100
    )
    const q = searchParams.get('q')?.trim() || ''
    const tier = searchParams.get('tier')?.trim() || ''
    const from = page * limit
    const to = from + limit - 1

    let query = supabase
      .from('gsch_organizations')
      .select(
        `
        id, name, org_type, country, city, logo_url,
        verification_status, verification_badge,
        subscription_tier, subscription_notes,
        subscription_updated_at, subscription_updated_by,
        created_at, updated_at
      `
      )
      .order('updated_at', { ascending: false })
      .range(from, to)

    if (tier) query = query.eq('subscription_tier', tier)
    if (q) query = query.or(`name.ilike.%${q}%,country.ilike.%${q}%`)

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
    return errorResponse(error?.message || 'Failed to load organizations', 500)
  }
}
