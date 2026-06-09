import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireMarketplaceAdmin } from '@/lib/marketplace/adminAuth'
import { jsonResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '@/lib/api-utils'
import { getAdminDashboardSummary } from '@/lib/marketplace/adminDashboardService'

export async function GET(request: NextRequest) {
  try {
    await requireMarketplaceAdmin(request)
    const serviceClient = createServiceClient()
    const summary = await getAdminDashboardSummary(serviceClient)
    return jsonResponse({ data: summary })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') return unauthorizedResponse()
    if (error instanceof Error && error.message === 'Forbidden') return forbiddenResponse()
    const message = error instanceof Error ? error.message : 'Internal server error'
    return errorResponse(message, 500)
  }
}
