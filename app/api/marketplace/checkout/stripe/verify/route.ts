import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    await getAuthenticatedUser(request)
    const body = await request.json()

    const { paymentIntentId } = body
    if (!paymentIntentId) {
      return errorResponse('paymentIntentId is required', 400)
    }

    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient.functions.invoke('verify-stripe-payment', {
      body: { paymentIntentId },
    })

    if (error) {
      return errorResponse(error.message || 'Verification failed', 400)
    }

    return jsonResponse({
      success: data.status === 'succeeded',
      status: data.status,
      amount: data.amount ? data.amount / 100 : undefined,
      currency: data.currency?.toUpperCase(),
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Internal server error', 500)
  }
}
