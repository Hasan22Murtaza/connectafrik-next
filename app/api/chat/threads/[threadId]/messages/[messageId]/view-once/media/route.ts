import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { requireChatThreadAccess } from '@/lib/chat/chatThreadAccess'
import { requireUnlockedLockedThread } from '@/lib/chat/chatLock'
import {
  VIEW_ONCE_ALREADY_OPENED,
  VIEW_ONCE_FORBIDDEN,
  loadViewOnceAttachmentBytes,
  verifyViewOnceToken,
} from '@/lib/chat/chatViewOnce'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ threadId: string; messageId: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { threadId, messageId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()

    const allowed = await requireChatThreadAccess(serviceClient, user.id, threadId)
    if (!allowed) {
      return errorResponse('Thread not found or access denied', 404)
    }

    const lockedDenial = await requireUnlockedLockedThread(request, serviceClient, user.id, threadId)
    if (lockedDenial) return lockedDenial

    const token =
      request.nextUrl.searchParams.get('token') ||
      request.headers.get('x-view-once-token') ||
      ''
    const attachmentId = (request.nextUrl.searchParams.get('attachmentId') || '').trim()

    if (!token || !attachmentId) {
      return errorResponse('Missing View Once token or attachment', 400)
    }

    if (!verifyViewOnceToken(token, user.id, threadId, messageId)) {
      return errorResponse('Invalid or expired View Once session', 403, {
        code: VIEW_ONCE_FORBIDDEN,
      })
    }

    const { data: message, error: msgError } = await serviceClient
      .from('chat_messages')
      .select('id, sender_id, view_once, view_once_opened, view_once_opened_by, is_deleted')
      .eq('id', messageId)
      .eq('thread_id', threadId)
      .maybeSingle()

    if (msgError) return errorResponse(msgError.message, 400)
    if (!message || message.is_deleted) return errorResponse('Message not found', 404)
    if (!message.view_once) {
      return errorResponse('This message is not a View Once message', 400)
    }
    if (message.sender_id === user.id) {
      return errorResponse('You cannot open this View Once message', 403, {
        code: VIEW_ONCE_FORBIDDEN,
      })
    }
    if (!message.view_once_opened || message.view_once_opened_by !== user.id) {
      return errorResponse('This View Once message is no longer available', 409, {
        code: VIEW_ONCE_ALREADY_OPENED,
      })
    }

    const media = await loadViewOnceAttachmentBytes(serviceClient, messageId, attachmentId)
    if (!media) {
      return errorResponse('This View Once message is no longer available', 410, {
        code: VIEW_ONCE_ALREADY_OPENED,
      })
    }

    return new NextResponse(new Uint8Array(media.body), {
      status: 200,
      headers: {
        'Content-Type': media.contentType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(media.fileName)}"`,
        'Cache-Control': 'no-store, no-cache, private, max-age=0',
        Pragma: 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to load View Once media', 500)
  }
}
