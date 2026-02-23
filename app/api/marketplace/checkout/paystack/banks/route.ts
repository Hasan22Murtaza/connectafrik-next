import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const country = searchParams.get('country') || 'nigeria'

    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient.functions.invoke('paystack-banks', {
      body: { country },
    })

    if (error) {
      return errorResponse(error.message || 'Failed to fetch banks', 400)
    }

    return jsonResponse({ data: data?.data || [] })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Internal server error', 500)
  }
}
