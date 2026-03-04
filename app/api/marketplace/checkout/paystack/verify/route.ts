import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    await getAuthenticatedUser(request)
    const body = await request.json()

    const { reference } = body
    if (!reference) {
      return errorResponse('reference is required', 400)
    }

    const serviceClient = createServiceClient()

    let data: any
    let error: any
    try {
      const result = await serviceClient.functions.invoke('paystack-verify', {
        body: { reference },
      })
      data = result.data
      error = result.error
    } catch {
      const getResult = await serviceClient.functions.invoke('paystack-verify', {
        body: { reference },
      })
      data = getResult.data
      error = getResult.error
    }

    if (error) {
      return errorResponse(error.message || 'Verification failed', 400)
    }

    const responseData = data?.data || data
    return jsonResponse({
      success: responseData?.status === 'success',
      status: responseData?.status || 'unknown',
      amount: responseData?.amount ? responseData.amount / 100 : undefined,
      currency: responseData?.currency?.toUpperCase(),
      data: responseData,
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Internal server error', 500)
  }
}
