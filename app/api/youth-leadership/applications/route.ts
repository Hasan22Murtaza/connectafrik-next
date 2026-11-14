import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { errorResponse, jsonResponse, unauthorizedResponse } from '@/lib/api-utils'
import { checkYouthLeadershipAccess } from '@/lib/youth-leadership/auth'

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const access = await checkYouthLeadershipAccess(supabase, user.id)
    if (!access.allowed) {
      return errorResponse(access.message || 'Access restricted', 403, {
        code: access.code,
      })
    }

    const status = new URL(request.url).searchParams.get('status')

    let query = supabase
      .from('youth_program_applications')
      .select(
        `
        id, program_id, status, guardian_approval_status, submitted_at, created_at, updated_at,
        program:youth_programs!program_id(
          id, title, status, organization_id,
          organization:youth_organizations!organization_id(id, name, logo_url)
        )
      `
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) return errorResponse(error.message, 400)
    return jsonResponse(data || [])
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load applications', 500)
  }
}
