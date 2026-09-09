import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { requireChatThreadAccess } from '@/lib/chat/chatThreadAccess'
import { requireUnlockedLockedThread } from '@/lib/chat/chatLock'
import {
  VIEW_ONCE_ALREADY_OPENED,
  VIEW_ONCE_FORBIDDEN,
  VIEW_ONCE_RECLAIM_MS,
  createViewOnceToken,
  detectViewOnceKind,
  publicViewOnceAttachments,
  updateThreadPreviewIfLatest,
  viewOnceThreadPreview,
} from '@/lib/chat/chatViewOnce'

type RouteContext = { params: Promise<{ threadId: string; messageId: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
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

    const { data: message, error: msgError } = await serviceClient
      .from('chat_messages')
      .select(
        'id, thread_id, sender_id, created_at, is_deleted, view_once, view_once_opened, view_once_opened_at, view_once_opened_by'
      )
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

    const { data: attachments } = await serviceClient
      .from('message_attachments')
      .select('id, file_name, file_size, file_type, file_url')
      .eq('message_id', messageId)

    const hasStoredMedia = (attachments || []).some((a) => String(a.file_url || '').trim())
    const kind = detectViewOnceKind(
      (attachments || []).map((a) => ({ file_type: a.file_type, file_name: a.file_name }))
    )

    if (!hasStoredMedia) {
      return errorResponse('This View Once message is no longer available', 409, {
        code: VIEW_ONCE_ALREADY_OPENED,
      })
    }

    if (message.view_once_opened) {
      const openedAt = message.view_once_opened_at
        ? new Date(message.view_once_opened_at).getTime()
        : 0
      const sameViewer = message.view_once_opened_by === user.id
      const withinReclaim =
        Number.isFinite(openedAt) && Date.now() - openedAt <= VIEW_ONCE_RECLAIM_MS

      if (!sameViewer || !withinReclaim || !hasStoredMedia) {
        return errorResponse('This View Once message is no longer available', 409, {
          code: VIEW_ONCE_ALREADY_OPENED,
        })
      }

      const token = createViewOnceToken(user.id, threadId, messageId)
      return jsonResponse({
        data: {
          token,
          attachments: publicViewOnceAttachments(attachments || []),
          view_once: true,
          view_once_opened: true,
          view_once_opened_at: message.view_once_opened_at,
          view_once_opened_by: message.view_once_opened_by,
        },
      })
    }

    const now = new Date().toISOString()
    const { data: claimed, error: claimError } = await serviceClient
      .from('chat_messages')
      .update({
        view_once_opened: true,
        view_once_opened_at: now,
        view_once_opened_by: user.id,
        updated_at: now,
      })
      .eq('id', messageId)
      .eq('thread_id', threadId)
      .eq('view_once', true)
      .eq('view_once_opened', false)
      .eq('is_deleted', false)
      .neq('sender_id', user.id)
      .select('id, view_once_opened, view_once_opened_at, view_once_opened_by')
      .maybeSingle()

    if (claimError) return errorResponse(claimError.message, 400)
    if (!claimed) {
      return errorResponse('This View Once message is no longer available', 409, {
        code: VIEW_ONCE_ALREADY_OPENED,
      })
    }

    await updateThreadPreviewIfLatest(
      serviceClient,
      threadId,
      message.created_at,
      viewOnceThreadPreview(kind, true)
    )

    const token = createViewOnceToken(user.id, threadId, messageId)
    return jsonResponse({
      data: {
        token,
        attachments: publicViewOnceAttachments(attachments || []),
        view_once: true,
        view_once_opened: true,
        view_once_opened_at: claimed.view_once_opened_at,
        view_once_opened_by: claimed.view_once_opened_by,
      },
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to open View Once message', 500)
  }
}
