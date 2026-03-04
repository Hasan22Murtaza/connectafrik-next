import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const body = await request.json()

    const { amount, email, currency, metadata, callback_url } = body
    if (!amount || !currency) {
      return errorResponse('amount and currency are required', 400)
    }

    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient.functions.invoke('paystack-init', {
      body: {
        amount: Math.round(amount * 100),
        email: email || user.email,
        currency,
        metadata: { ...metadata, buyer_id: user.id },
        callback_url,
      },
    })

    if (error) {
      return errorResponse(error.message || 'Failed to initialize Paystack transaction', 400)
    }

    const responseData = data?.data || data
    if (!responseData?.authorization_url) {
      return errorResponse('Invalid response from payment service', 500)
    }

    return jsonResponse({
      authorization_url: responseData.authorization_url,
      reference: responseData.reference,
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Internal server error', 500)
  }
}
