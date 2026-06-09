import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireMarketplaceAdmin } from '@/lib/marketplace/adminAuth'
import {
  jsonResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/api-utils'
import {
  deleteAdminUser,
  getAdminUserDetail,
  suspendAdminUser,
  unsuspendAdminUser,
} from '@/lib/marketplace/adminUserService'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await requireMarketplaceAdmin(request)
    const { userId } = await params
    const serviceClient = createServiceClient()
    const data = await getAdminUserDetail(serviceClient, userId)
    return jsonResponse({ data })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') return unauthorizedResponse()
    if (error instanceof Error && error.message === 'Forbidden') return forbiddenResponse()
    if (error instanceof Error && error.message === 'User not found') {
      return errorResponse('User not found', 404)
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return errorResponse(message, 500)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { user: admin } = await requireMarketplaceAdmin(request)
    const { userId } = await params
    const body = await request.json()
    const action = body?.action as string | undefined

    if (action !== 'suspend' && action !== 'unsuspend') {
      return errorResponse('Invalid action. Use suspend or unsuspend.', 400)
    }

    const serviceClient = createServiceClient()
    const data =
      action === 'suspend'
        ? await suspendAdminUser(serviceClient, userId, admin.id)
        : await unsuspendAdminUser(serviceClient, userId, admin.id)

    return jsonResponse({ data })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') return unauthorizedResponse()
    if (error instanceof Error && error.message === 'Forbidden') return forbiddenResponse()
    if (error instanceof Error && error.message === 'User not found') {
      return errorResponse('User not found', 404)
    }
    if (error instanceof Error && error.message.startsWith('Cannot manage')) {
      return forbiddenResponse(error.message)
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return errorResponse(message, 500)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { user: admin } = await requireMarketplaceAdmin(request)
    const { userId } = await params
    const serviceClient = createServiceClient()
    const result = await deleteAdminUser(serviceClient, userId, admin.id)
    return jsonResponse(result)
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') return unauthorizedResponse()
    if (error instanceof Error && error.message === 'Forbidden') return forbiddenResponse()
    if (error instanceof Error && error.message === 'User not found') {
      return errorResponse('User not found', 404)
    }
    if (error instanceof Error && error.message.startsWith('Cannot manage')) {
      return forbiddenResponse(error.message)
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return errorResponse(message, 500)
  }
}
