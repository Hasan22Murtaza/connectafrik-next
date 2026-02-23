import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    await getAuthenticatedUser(request)
    const body = await request.json()

    const { source, amount, recipient, reason, reference, currency } = body
    if (!amount || !recipient) {
      return errorResponse('amount and recipient are required', 400)
    }

    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient.functions.invoke('paystack-transfer', {
      body: {
        source: source || 'balance',
        amount: Math.round(amount * 100),
        recipient,
        reason,
        reference,
        currency,
      },
    })

    if (error) {
      return errorResponse(error.message || 'Transfer failed', 400)
    }

    if (!data?.data) {
      return errorResponse('Transfer failed', 500)
    }

    return jsonResponse({
      transfer_code: data.data.transfer_code,
      reference: data.data.reference,
      status: data.data.status,
      details: data.data,
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Internal server error', 500)
  }
}
