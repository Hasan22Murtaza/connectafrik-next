import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    await getAuthenticatedUser(request)
    const body = await request.json()

    const { account_number, bank_code } = body
    if (!account_number || !bank_code) {
      return errorResponse('account_number and bank_code are required', 400)
    }

    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient.functions.invoke('paystack-resolve-account', {
      body: { account_number, bank_code },
    })

    if (error) {
      return errorResponse(error.message || 'Failed to resolve account', 400)
    }

    if (!data?.data) {
      return errorResponse('Could not resolve account', 404)
    }

    return jsonResponse({
      account_name: data.data.account_name,
      account_number: data.data.account_number,
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Internal server error', 500)
  }
}
