import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    await getAuthenticatedUser(request)
    const body = await request.json()

    const { phone, provider } = body
    if (!phone || !provider) {
      return errorResponse('phone and provider are required', 400)
    }

    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient.functions.invoke('paystack-verify-momo', {
      body: { phone, provider },
    })

    if (error) {
      return errorResponse(error.message || 'Verification failed', 400)
    }

    if (!data?.data) {
      return errorResponse('Could not verify mobile money account', 404)
    }

    return jsonResponse({
      account_name: data.data.account_name,
      phone: data.data.phone,
      provider: data.data.provider,
      is_registered: data.data.is_registered,
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Internal server error', 500)
  }
}
