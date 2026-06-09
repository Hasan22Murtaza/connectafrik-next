import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireMarketplaceAdmin } from '@/lib/marketplace/adminAuth'
import { jsonResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    await requireMarketplaceAdmin(request)
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
    if (error?.message === 'Forbidden') return forbiddenResponse()
    return errorResponse(error?.message || 'Internal server error', 500)
  }
}
