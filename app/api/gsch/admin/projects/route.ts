import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { isPlatformGschAdmin } from '@/lib/gsch/auth'
import { GSCH_PROJECT_SELECT } from '@/lib/gsch/selects'

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    if (!(await isPlatformGschAdmin(supabase, user.id))) {
      return forbiddenResponse('Platform admin access required.')
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')?.trim() || ''
    const page = Math.max(parseInt(searchParams.get('page') || '0', 10) || 0, 0)
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1),
      50
    )
    const from = page * limit
    const to = from + limit - 1

    let query = supabase
      .from('gsch_projects')
      .select(GSCH_PROJECT_SELECT)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (status) {
      query = query.eq('verification_status', status)
    } else {
      query = query.in('verification_status', ['pending_review', 'unverified'])
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
    return errorResponse(error?.message || 'Failed to load project queue', 500)
  }
}
