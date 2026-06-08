import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireMarketplaceAdmin } from '@/lib/marketplace/adminAuth'
import { jsonResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '@/lib/api-utils'
import { listAdminDisputes } from '@/lib/marketplace/disputeService'

export async function GET(request: NextRequest) {
  try {
    await requireMarketplaceAdmin(request)
    const serviceClient = createServiceClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined

    const disputes = await listAdminDisputes(serviceClient, status)

    return jsonResponse({ data: disputes })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return forbiddenResponse()
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return errorResponse(message, 500)
  }
}
