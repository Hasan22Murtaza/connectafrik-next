import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const { orderId } = await params
    const serviceClient = createServiceClient()
    const body = await request.json().catch(() => ({}))

    const trackingNumber = body.tracking_number || null
    const useAutoPayout = process.env.NEXT_PUBLIC_ENABLE_AUTO_PAYOUTS === 'true'

    const { data, error } = await serviceClient.rpc(
      useAutoPayout ? 'confirm_delivery_with_auto_payout' : 'confirm_delivery',
      {
        p_order_id: orderId,
        p_confirmed_by: user.id,
        p_tracking_number: trackingNumber,
      }
    )

    if (error) {
      return errorResponse(error.message, 400)
    }

    return jsonResponse({ data })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Internal server error', 500)
  }
}
