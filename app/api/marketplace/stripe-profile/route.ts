import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  addSavedPaymentMethod,
  deleteSavedPaymentMethod,
  listSavedPaymentMethods,
  setDefaultPaymentMethod,
} from '@/lib/marketplace/stripePaymentMethods'

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const methods = await listSavedPaymentMethods(serviceClient, user.id)

    return jsonResponse(methods)
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
    const body = await request.json()
    const { token, name } = body

    if (!token || !name?.trim()) {
      return errorResponse('Card holder name and token are required', 400)
    }

    const serviceClient = createServiceClient()
    const saved = await addSavedPaymentMethod(
      serviceClient,
      user.id,
      token,
      name.trim(),
      user.email
    )

    return jsonResponse(saved, 200, 'Card added successfully')
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return errorResponse(message, 500)
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const body = await request.json()
    const { paymentMethodId } = body

    if (!paymentMethodId) {
      return errorResponse('paymentMethodId is required', 400)
    }

    const serviceClient = createServiceClient()
    const updated = await setDefaultPaymentMethod(serviceClient, user.id, paymentMethodId)

    return jsonResponse(updated, 200, 'Default card updated successfully')
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return errorResponse(message, 500)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const body = await request.json()
    const { paymentMethodId } = body

    if (!paymentMethodId) {
      return errorResponse('paymentMethodId is required', 400)
    }

    const serviceClient = createServiceClient()
    await deleteSavedPaymentMethod(serviceClient, user.id, paymentMethodId)

    return jsonResponse(null, 200, 'Card deleted successfully')
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return errorResponse(message, 500)
  }
}
