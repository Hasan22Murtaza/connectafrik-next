import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireMarketplaceAdmin } from '@/lib/marketplace/adminAuth'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import {
  deleteFeedback,
  getFeedbackById,
  isFeedbackStatus,
  updateFeedback,
} from '@/lib/feedback/feedbackService'
import { deleteFromBunny } from '@/lib/bunny'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireMarketplaceAdmin(request)
    const { id } = await context.params
    const serviceClient = createServiceClient()
    const feedback = await getFeedbackById(serviceClient, id)

    if (!feedback) {
      return errorResponse('Feedback not found', 404)
    }

    return jsonResponse(feedback)
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return forbiddenResponse()
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return errorResponse(message, 500)
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireMarketplaceAdmin(request)
    const { id } = await context.params
    const body = await request.json()
    const serviceClient = createServiceClient()

    if (body.status !== undefined && !isFeedbackStatus(body.status)) {
      return errorResponse('Invalid feedback status', 400)
    }

    const existing = await getFeedbackById(serviceClient, id)
    if (!existing) {
      return errorResponse('Feedback not found', 404)
    }

    const updated = await updateFeedback(serviceClient, id, {
      status: body.status,
      internal_notes:
        body.internal_notes !== undefined ? body.internal_notes : undefined,
      admin_response:
        body.admin_response !== undefined ? body.admin_response : undefined,
      reviewed_by: user.id,
    })

    return jsonResponse(updated, 200, 'Feedback updated')
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return forbiddenResponse()
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('Invalid') || message.includes('No updates') ? 400 : 500
    return errorResponse(message, status)
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    await requireMarketplaceAdmin(request)
    const { id } = await context.params
    const serviceClient = createServiceClient()

    const deleted = await deleteFeedback(serviceClient, id)

    if (deleted.attachment_path || deleted.attachment_url) {
      try {
        await deleteFromBunny(deleted.attachment_path || deleted.attachment_url!)
      } catch (err) {
        console.warn('Failed to delete feedback attachment from Bunny:', err)
      }
    }

    return jsonResponse({ deleted: true }, 200, 'Feedback deleted')
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return forbiddenResponse()
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('not found') ? 404 : 500
    return errorResponse(message, status)
  }
}
