import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireMarketplaceAdmin } from '@/lib/marketplace/adminAuth'
import {
  jsonResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/api-utils'
import { getAdminOrderDetail } from '@/lib/marketplace/adminDashboardService'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    await requireMarketplaceAdmin(request)
    const { orderId } = await params
    const serviceClient = createServiceClient()

    const order = await getAdminOrderDetail(serviceClient, orderId)

    return jsonResponse({ data: order })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') return unauthorizedResponse()
    if (error instanceof Error && error.message === 'Forbidden') return forbiddenResponse()
    if (error instanceof Error && error.message === 'Order not found') {
      return errorResponse('Order not found', 404)
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return errorResponse(message, 500)
  }
}
