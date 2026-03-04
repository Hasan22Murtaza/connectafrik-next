import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()

    const { data, error } = await serviceClient
      .from('platform_revenue_summary')
      .select('*')
      .single()

    if (error) {
      return errorResponse(error.message, 400)
    }

    return jsonResponse({ data })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Internal server error', 500)
  }
}
