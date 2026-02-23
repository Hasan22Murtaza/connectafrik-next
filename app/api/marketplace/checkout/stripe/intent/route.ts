import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const body = await request.json()

    const { amount, currency, metadata } = body
    if (!amount || !currency) {
      return errorResponse('amount and currency are required', 400)
    }

    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient.functions.invoke('create-stripe-payment', {
      body: {
        amount: Math.round(amount * 100),
        currency: currency.toLowerCase(),
        metadata: { ...metadata, buyer_id: user.id },
      },
    })

    if (error) {
      return errorResponse(error.message || 'Failed to create payment intent', 400)
    }

    if (!data?.clientSecret) {
      return errorResponse('Invalid response from payment service', 500)
    }

    return jsonResponse({
      clientSecret: data.clientSecret,
      paymentIntentId: data.paymentIntentId,
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Internal server error', 500)
  }
}
