import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { requireChatThreadAccess } from '@/lib/chat/chatThreadAccess'
import { requireUnlockedLockedThread } from '@/lib/chat/chatLock'
import { sanitizeViewOnceMessage } from '@/lib/chat/chatViewOnce'
import { isEncodedMessage } from '@/lib/chat/messageCodec'
import { isMessageE2eeEnabledForUser } from '@/lib/message-e2ee/flag'

const MESSAGE_SELECT = `
  *,
  sender:profiles!chat_messages_sender_id_fkey(id, username, full_name, avatar_url)
`

type RouteContext = { params: Promise<{ threadId: string; messageId: string }> }

const loadSignalEnvelopes = async (serviceClient: any, message: any, readerId: string) => {
  if (message?.e2ee_version !== 3) return message
  const { data } = await serviceClient
    .from('signal_message_envelopes')
    .select('recipient_user_id, recipient_device_id, message_type, ciphertext')
    .eq('message_id', message.id)
    .eq('recipient_user_id', readerId)
  const envelopes = (data || []).map((row: any) => ({
    recipient_user_id: row.recipient_user_id as string,
    recipient_device_id: row.recipient_device_id as string,
    type: Number(row.message_type),
    body: row.ciphertext as string,
  }))
  if (envelopes.length === 1) {
    return {
      ...message,
      envelopes,
      ciphertext: envelopes[0].body,
    }
  }
  return { ...message, envelopes }
}

const enrichMessageResponse = async (serviceClient: any, message: any, fallbackReaderId: string) => {
  const [readsRes, attachmentsRes, withEnvelopes] = await Promise.all([
    serviceClient.from('message_reads').select('user_id').eq('message_id', message.id),
    serviceClient.from('message_attachments').select('*').eq('message_id', message.id),
    loadSignalEnvelopes(serviceClient, message, fallbackReaderId),
  ])
  const rawReadBy = (readsRes.data || []).map((r: any) => r.user_id)
  const readerIds = [...new Set([...rawReadBy, fallbackReaderId])]
  const { getRelationships, filterReadByForViewer } = await import('@/lib/privacy')
  const relationships = await getRelationships(fallbackReaderId, readerIds, serviceClient)
  const readBy = filterReadByForViewer(readerIds, fallbackReaderId, relationships)
  return sanitizeViewOnceMessage({
    ...withEnvelopes,
    read_by: readBy.length ? readBy : [fallbackReaderId],
    attachments: attachmentsRes.data || [],
    reactions: [],
  })
}

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

    const { data: message, error: msgError } = await serviceClient
      .from('chat_messages')
      .select(MESSAGE_SELECT)
      .eq('id', messageId)
      .eq('thread_id', threadId)
      .maybeSingle()

    if (msgError) return errorResponse(msgError.message, 400)
    if (!message) return errorResponse('Message not found', 404)

    const data = await enrichMessageResponse(serviceClient, message, user.id)
    return jsonResponse({ data })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to load message', 500)
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { threadId, messageId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const body = await request.json()
    const content = body.content
    const isForwardFlag = body.is_forward

    const allowed = await requireChatThreadAccess(serviceClient, user.id, threadId)
    if (!allowed) {
      return errorResponse('Thread not found or access denied', 404)
    }

    if (typeof content !== 'string') {
      return errorResponse('content must be a string', 400)
    }
    const e2eeVersionRaw = body.e2ee_version === 2 || body.e2ee_version === '2'
      ? 2
      : body.e2ee_version === 3 || body.e2ee_version === '3'
        ? 3
        : null
    const wantsE2ee = e2eeVersionRaw === 2 || e2eeVersionRaw === 3
    let sealedCiphertext = typeof body.ciphertext === 'string' ? body.ciphertext : ''
    const sealedDeviceId = typeof body.sender_device_id === 'string' ? body.sender_device_id : ''
    let signalEnvelopes: Array<{
      recipient_user_id: string
      recipient_device_id: string
      type: number
      body: string
    }> = []
    if (wantsE2ee) {
      if (!isMessageE2eeEnabledForUser(user.id)) {
        return errorResponse('End-to-end encryption is not enabled for this account', 403)
      }
      if (e2eeVersionRaw === 3 && Array.isArray(body.envelopes)) {
        signalEnvelopes = body.envelopes
          .map((item: unknown) => {
            if (!item || typeof item !== 'object') return null
            const row = item as Record<string, unknown>
            const recipientUserId = typeof row.recipient_user_id === 'string' ? row.recipient_user_id : ''
            const recipientDeviceId =
              typeof row.recipient_device_id === 'string' ? row.recipient_device_id : ''
            const msgType = typeof row.type === 'number' ? row.type : Number(row.type)
            const envelopeBody = typeof row.body === 'string' ? row.body : ''
            if (!recipientUserId || !recipientDeviceId || !envelopeBody || (msgType !== 1 && msgType !== 3)) {
              return null
            }
            return {
              recipient_user_id: recipientUserId,
              recipient_device_id: recipientDeviceId,
              type: msgType,
              body: envelopeBody,
            }
          })
          .filter(Boolean) as typeof signalEnvelopes
      }
      if (e2eeVersionRaw === 3) {
        if (sealedCiphertext.trim().startsWith('{')) {
          return errorResponse('Encrypted message ciphertext must be the Signal body only', 400)
        }
        if (signalEnvelopes.length > 0) {
          sealedCiphertext = signalEnvelopes[0]!.body
        }
        if (!sealedCiphertext || !sealedDeviceId || sealedCiphertext.length > 200_000) {
          return errorResponse('Encrypted message is missing its ciphertext', 400)
        }
      } else if (!sealedCiphertext || !sealedDeviceId || sealedCiphertext.length > 500_000) {
        return errorResponse('Encrypted message is missing its ciphertext', 400)
      }
    }
    const safeContent = wantsE2ee ? '' : content.trim()

    const { data: existing, error: fetchError } = await serviceClient
      .from('chat_messages')
      .select('id, sender_id, thread_id, message_type, is_deleted, view_once')
      .eq('id', messageId)
      .eq('thread_id', threadId)
      .maybeSingle()

    if (fetchError) return errorResponse(fetchError.message, 400)
    if (!existing) return errorResponse('Message not found', 404)
    if (existing.sender_id !== user.id) {
      return errorResponse('Only the sender can edit this message', 403)
    }
    if (existing.is_deleted) {
      return errorResponse('Cannot edit a deleted message', 400)
    }
    const type = existing.message_type || 'text'
    if (type !== 'text') {
      return errorResponse('Only text messages can be edited', 400)
    }
    if ((existing as { view_once?: boolean }).view_once) {
      return errorResponse('View Once messages cannot be edited', 400)
    }

    if (!safeContent && !wantsE2ee) {
      return errorResponse('content cannot be empty', 400)
    }

    const now = new Date().toISOString()
    const updateRow: Record<string, unknown> = {
      content: safeContent,
      updated_at: now,
      is_edited: true,
      ...(wantsE2ee
        ? {
            ciphertext: sealedCiphertext,
            sender_device_id: sealedDeviceId,
            e2ee_version: e2eeVersionRaw,
          }
        : isEncodedMessage(safeContent)
          ? { e2ee_version: 1 }
          : {}),
    }
    if (typeof isForwardFlag === 'boolean') {
      updateRow.is_forward = isForwardFlag
    }
    const { data: updated, error: updateError } = await serviceClient
      .from('chat_messages')
      .update(updateRow)
      .eq('id', messageId)
      .eq('thread_id', threadId)
      .select(MESSAGE_SELECT)
      .single()

    if (updateError || !updated) {
      return errorResponse(updateError?.message || 'Failed to update message', 400)
    }

    if (e2eeVersionRaw === 3 && signalEnvelopes.length > 0) {
      await serviceClient.from('signal_message_envelopes').delete().eq('message_id', messageId)
      const envelopeRows = signalEnvelopes.map((item) => ({
        message_id: messageId,
        recipient_user_id: item.recipient_user_id,
        recipient_device_id: item.recipient_device_id,
        message_type: item.type,
        ciphertext: item.body,
      }))
      const { error: envelopeError } = await serviceClient.from('signal_message_envelopes').insert(envelopeRows)
      if (envelopeError) {
        return errorResponse(envelopeError.message || 'Failed to store encrypted envelopes', 400)
      }
    }

    const { data: latest } = await serviceClient
      .from('chat_messages')
      .select('id')
      .eq('thread_id', threadId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latest?.id === messageId) {
      const preview = wantsE2ee
        ? '🔒 Encrypted message'
        : isEncodedMessage(safeContent)
        ? safeContent
        : safeContent.length > 100
          ? safeContent.slice(0, 97) + '...'
          : safeContent
      await serviceClient
        .from('chat_threads')
        .update({
          last_message_preview: preview,
          last_message_at: now,
          last_activity_at: now,
          updated_at: now,
        })
        .eq('id', threadId)
    }

    const data = await enrichMessageResponse(serviceClient, updated, user.id)
    return jsonResponse({ data })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to update message', 500)
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { threadId, messageId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()

    const allowed = await requireChatThreadAccess(serviceClient, user.id, threadId)
    if (!allowed) {
      return errorResponse('Thread not found or access denied', 404)
    }

    const { data: msg } = await serviceClient
      .from('chat_messages')
      .select('id, sender_id')
      .eq('id', messageId)
      .eq('thread_id', threadId)
      .single()

    if (!msg) return errorResponse('Message not found', 404)
    if (msg.sender_id !== user.id) return errorResponse('Only the sender can delete this message', 403)

    const { error } = await serviceClient
      .from('chat_messages')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        content: '',
        ciphertext: null,
        sender_device_id: null,
      })
      .eq('id', messageId)
      .eq('thread_id', threadId)

    if (error) return errorResponse(error.message, 400)
    return jsonResponse({ success: true })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to delete message', 500)
  }
}
