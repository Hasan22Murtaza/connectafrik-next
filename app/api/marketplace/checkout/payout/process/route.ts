import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { executePaystackPayout } from '@/lib/marketplace/payoutTransfer'

export async function POST(request: NextRequest) {
  try {
    await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const body = await request.json()

    const { payout_id, seller_id, amount, order_id, currency } = body
    if (!payout_id || !seller_id || !amount || !order_id) {
      return errorResponse('payout_id, seller_id, amount, and order_id are required', 400)
    }

    const result = await executePaystackPayout(serviceClient, {
      payout_id,
      seller_id,
      amount,
      order_id,
      currency: currency || 'NGN',
    })

    if (!result.success) {
      return errorResponse(result.error || 'Transfer failed', 500)
    }

    return jsonResponse({
      success: true,
      transfer_code: result.transfer_code,
      reference: result.reference,
      status: result.status,
      method: result.method,
    })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return errorResponse(message, 500)
  }
}
