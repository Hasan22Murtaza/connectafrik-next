import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    await getAuthenticatedUser(request)
    const body = await request.json()

    const { type, name, account_number, bank_code, currency, email, phone, provider } = body
    if (!type || !name) {
      return errorResponse('type and name are required', 400)
    }

    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient.functions.invoke('paystack-create-recipient', {
      body: { type, name, account_number, bank_code, currency, email, phone, provider },
    })

    if (error) {
      return errorResponse(error.message || 'Failed to create recipient', 400)
    }

    if (!data?.data?.recipient_code) {
      return errorResponse('Failed to create recipient', 500)
    }

    return jsonResponse({
      recipient_code: data.data.recipient_code,
      details: data.data,
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Internal server error', 500)
  }
}
