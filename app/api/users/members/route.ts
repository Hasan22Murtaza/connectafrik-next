import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const { supabase } = await getAuthenticatedUser(request)

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, status, last_seen')
      .order('username', { ascending: true })

    if (error) return errorResponse(error.message, 400)
    return jsonResponse({ data: data || [] })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to fetch members', 500)
  }
}
