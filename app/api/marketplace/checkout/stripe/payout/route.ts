import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    await getAuthenticatedUser(request)
    const body = await request.json()

    const { sellerId, amount, currency, destination } = body
    if (!sellerId || !amount || !currency || !destination) {
      return errorResponse('sellerId, amount, currency, and destination are required', 400)
    }

    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient.functions.invoke('create-stripe-payout', {
      body: {
        sellerId,
        amount: Math.round(amount * 100),
        currency: currency.toLowerCase(),
        destination,
      },
    })

    if (error) {
      return errorResponse(error.message || 'Payout failed', 400)
    }

    return jsonResponse({ payoutId: data.payoutId })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Internal server error', 500)
  }
}
