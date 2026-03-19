import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

const MESSAGE_SELECT = `
  *,
  sender:profiles!chat_messages_sender_id_fkey(id, username, full_name, avatar_url)
`

type RouteContext = { params: Promise<{ threadId: string }> }
const DEDUPED_CALL_SIGNAL_TYPES = new Set(['call_accepted', 'call_rejected', 'missed_call', 'call_ended'])
const ROOM_FALLBACK_DEDUPE_WINDOW_MS = 5 * 60 * 1000
const TERMINAL_CONFLICT_WINDOW_MS = 90 * 1000
const CALL_TERMINAL_CONFLICT_TYPES = ['call_rejected', 'call_ended'] as const
type CallIdentity = { callId: string; roomId: string }

const normalizeCallIdentityValue = (value: unknown): string => (
  typeof value === 'string' ? value.trim() : ''
)

const extractCallIdentity = (meta: unknown): CallIdentity => {
  if (!meta || typeof meta !== 'object') return { callId: '', roomId: '' }
  const metadata = meta as Record<string, unknown>
  const callId = normalizeCallIdentityValue(metadata.callId) || normalizeCallIdentityValue(metadata.call_id)
  const roomId = normalizeCallIdentityValue(metadata.roomId) || normalizeCallIdentityValue(metadata.room_id)
  return { callId, roomId }
}

const isSameCallIdentity = (
  incomingIdentity: CallIdentity,
  existingIdentity: CallIdentity,
  existingCreatedAt: string
): boolean => {
  if (incomingIdentity.callId && existingIdentity.callId) {
    return incomingIdentity.callId === existingIdentity.callId
  }
  if (incomingIdentity.roomId && existingIdentity.roomId) {
    if (incomingIdentity.roomId !== existingIdentity.roomId) return false
    const existingTs = new Date(existingCreatedAt).getTime()
    return Number.isFinite(existingTs) && (Date.now() - existingTs) <= ROOM_FALLBACK_DEDUPE_WINDOW_MS
  }

  // Last fallback when metadata is incomplete on either side: short time window in same thread.
  const existingTs = new Date(existingCreatedAt).getTime()
  return Number.isFinite(existingTs) && (Date.now() - existingTs) <= TERMINAL_CONFLICT_WINDOW_MS
}

const enrichMessageResponse = async (serviceClient: any, message: any, fallbackReaderId: string) => {
  const [readsRes, attachmentsRes] = await Promise.all([
    serviceClient.from('message_reads').select('user_id').eq('message_id', message.id),
    serviceClient.from('message_attachments').select('*').eq('message_id', message.id),
  ])
  const readBy = (readsRes.data || []).map((r: any) => r.user_id)
  return {
    ...message,
    read_by: readBy.length ? readBy : [fallbackReaderId],
    attachments: attachmentsRes.data || [],
  }
}

const findMatchingCallSignal = (messages: any[], incomingIdentity: CallIdentity) => {
  return messages.find((m: any) => {
    const existingIdentity = extractCallIdentity(m?.metadata)
    return isSameCallIdentity(incomingIdentity, existingIdentity, m.created_at)
  })
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { threadId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()

    const { data: participant } = await serviceClient
      .from('chat_participants')
      .select('id')
      .eq('thread_id', threadId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!participant) {
      return errorResponse('Thread not found or access denied', 404)
    }

    const { searchParams } = new URL(request.url)
    const parsedLimit = parseInt(searchParams.get('limit') || '50', 10)
    const parsedPage = parseInt(searchParams.get('page') || '0', 10)
    const limit = Number.isNaN(parsedLimit) ? 50 : Math.min(Math.max(parsedLimit, 1), 100)
    const page = Number.isNaN(parsedPage) ? 0 : Math.max(parsedPage, 0)
    const from = page * limit
    const to = from + limit - 1

    const [messagesRes, countRes] = await Promise.all([
      serviceClient
        .from('chat_messages')
        .select(MESSAGE_SELECT)
        .eq('thread_id', threadId)
        .eq('is_deleted', false)
        // Fetch newest slice first so page 0 contains latest messages.
        .order('created_at', { ascending: false })
        .range(from, to),
      serviceClient
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('thread_id', threadId)
        .eq('is_deleted', false),
    ])

    const { data: messages, error } = messagesRes

    if (error) return errorResponse(error.message, 400)
    if (countRes.error) return errorResponse(countRes.error.message, 400)
    const list = messages || []
    const totalCount = countRes.count || 0
    const totalPages = totalCount > 0 ? Math.ceil(totalCount / limit) : 0

    if (list.length === 0) {
      return jsonResponse({ data: [], page, pageSize: limit, hasMore: false, totalCount, totalPages })
    }

    const messageIds = list.map((m: any) => m.id)
    const [readsRes, attachmentsRes] = await Promise.all([
      serviceClient.from('message_reads').select('message_id, user_id').in('message_id', messageIds),
      serviceClient.from('message_attachments').select('*').in('message_id', messageIds),
    ])

    const readByMessage = new Map<string, string[]>()
    for (const r of readsRes.data || []) {
      const arr = readByMessage.get(r.message_id) || []
      arr.push(r.user_id)
      readByMessage.set(r.message_id, arr)
    }
    const attachmentsByMessage = new Map<string, any[]>()
    for (const a of attachmentsRes.data || []) {
      const arr = attachmentsByMessage.get(a.message_id) || []
      arr.push(a)
      attachmentsByMessage.set(a.message_id, arr)
    }

    const formatted = list.map((m: any) => ({
      ...m,
      read_by: readByMessage.get(m.id) || [],
      attachments: attachmentsByMessage.get(m.id) || [],
    }))
    // Preserve natural chat display (oldest -> newest) inside the fetched page.
    const chronological = [...formatted].reverse()

    return jsonResponse({
      data: chronological,
      page,
      pageSize: limit,
      hasMore: totalCount > (to + 1),
      totalCount,
      totalPages,
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to fetch messages', 500)
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { threadId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const body = await request.json()
    const content = body.content as string
    const message_type = body.message_type as string | undefined
    const metadata = body.metadata as Record<string, unknown> | undefined
    const attachments = body.attachments as { name: string; size: number; mimeType: string; url: string }[] | undefined
    const reply_to_id = body.reply_to_id as string | undefined

    const { data: participant } = await serviceClient
      .from('chat_participants')
      .select('id')
      .eq('thread_id', threadId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!participant) {
      return errorResponse('Thread not found or access denied', 404)
    }

    const safeContent = typeof content === 'string' ? content : ''
    const hasAttachments = attachments && attachments.length > 0
    const preview = safeContent.length > 100 ? safeContent.slice(0, 97) + '...' : (safeContent || (hasAttachments ? 'Shared an attachment' : ''))
    const now = new Date().toISOString()
    const normalizedMessageType = message_type || 'text'
    const incomingIdentity = extractCallIdentity(metadata)

    if (DEDUPED_CALL_SIGNAL_TYPES.has(normalizedMessageType)) {
      const { data: sameTypeMessages, error: sameTypeError } = await serviceClient
        .from('chat_messages')
        .select(MESSAGE_SELECT)
        .eq('thread_id', threadId)
        .eq('message_type', normalizedMessageType)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(30)

      if (!sameTypeError && sameTypeMessages?.length) {
        const existingMatch = findMatchingCallSignal(sameTypeMessages, incomingIdentity)

        if (existingMatch) {
          const data = await enrichMessageResponse(serviceClient, existingMatch, user.id)
          return jsonResponse({ data }, 200)
        }
      }
    }

    // Conflict rule: if call is already rejected/ended, do not store missed_call for same call.
    if (normalizedMessageType === 'missed_call') {
      const { data: terminalConflictMessages, error: terminalConflictError } = await serviceClient
        .from('chat_messages')
        .select(MESSAGE_SELECT)
        .eq('thread_id', threadId)
        .in('message_type', [...CALL_TERMINAL_CONFLICT_TYPES])
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(30)

      if (!terminalConflictError && terminalConflictMessages?.length) {
        const conflictMatch = findMatchingCallSignal(terminalConflictMessages, incomingIdentity)

        if (conflictMatch) {
          const data = await enrichMessageResponse(serviceClient, conflictMatch, user.id)
          return jsonResponse({ data }, 200)
        }
      }
    }

    const { data: message, error: msgError } = await serviceClient
      .from('chat_messages')
      .insert({
        thread_id: threadId,
        sender_id: user.id,
        content: safeContent,
        message_type: normalizedMessageType,
        metadata: metadata || null,
        reply_to_id: reply_to_id || null,
      })
      .select(MESSAGE_SELECT)
      .single()

    if (msgError || !message) {
      return errorResponse(msgError?.message || 'Failed to send message', 400)
    }

    await Promise.all([
      serviceClient.from('message_reads').insert({ message_id: message.id, user_id: user.id }),
      serviceClient
        .from('chat_threads')
        .update({
          last_message_preview: preview,
          last_message_at: now,
          last_activity_at: now,
          updated_at: now,
        })
        .eq('id', threadId),
    ])

    if (attachments && attachments.length > 0) {
      await serviceClient.from('message_attachments').insert(
        attachments.map((a) => ({
          message_id: message.id,
          file_name: a.name,
          file_size: a.size,
          file_type: a.mimeType,
          file_url: a.url,
        }))
      )
    }

    const { data: attData } = await serviceClient
      .from('message_attachments')
      .select('*')
      .eq('message_id', message.id)

    const result = {
      ...message,
      read_by: [user.id],
      attachments: attData || [],
    }

    return jsonResponse({ data: result }, 201)
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to send message', 500)
  }
}
