import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { openDispute, listUserDisputes, DisputeReason } from '@/lib/marketplace/disputeService'

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role') as 'buyer' | 'seller' | null

    const disputes = await listUserDisputes(
      serviceClient,
      user.id,
      role ?? undefined
    )

    return jsonResponse({ data: disputes })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return errorResponse(message, 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const body = await request.json()

    const { order_id, reason, description, requested_resolution, requested_amount } = body

    if (!order_id || !reason || !description?.trim()) {
      return errorResponse('order_id, reason, and description are required', 400)
    }

    const dispute = await openDispute(serviceClient, {
      orderId: order_id,
      buyerId: user.id,
      reason: reason as DisputeReason,
      description: description.trim(),
      requestedResolution: requested_resolution,
      requestedAmount: requested_amount != null ? Number(requested_amount) : undefined,
    })

    return jsonResponse({ data: dispute })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return errorResponse(message, message === 'Internal server error' ? 500 : 400)
  }
}
