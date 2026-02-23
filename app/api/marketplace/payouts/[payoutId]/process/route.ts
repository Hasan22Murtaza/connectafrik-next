import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ payoutId: string }> }
) {
  try {
    await getAuthenticatedUser(request)
    const { payoutId } = await params
    const serviceClient = createServiceClient()
    const body = await request.json()

    const { payout_reference, notes } = body
    if (!payout_reference) {
      return errorResponse('payout_reference is required', 400)
    }

    const { data, error } = await serviceClient.rpc('process_seller_payout', {
      p_payout_id: payoutId,
      p_payout_reference: payout_reference,
      p_notes: notes || null,
    })

    if (error) {
      return errorResponse(error.message, 400)
    }

    return jsonResponse({ data })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Internal server error', 500)
  }
}
