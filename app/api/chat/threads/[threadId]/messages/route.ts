import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

const MESSAGE_SELECT = `
  *,
  sender:profiles!chat_messages_sender_id_fkey(id, username, full_name, avatar_url)
`

type RouteContext = { params: Promise<{ threadId: string }> }

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
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    const { data: messages, error } = await serviceClient
      .from('chat_messages')
      .select(MESSAGE_SELECT)
      .eq('thread_id', threadId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) return errorResponse(error.message, 400)
    const list = messages || []

    if (list.length === 0) {
      return jsonResponse({ data: [], limit, offset })
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

    return jsonResponse({ data: formatted, limit, offset })
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

    const { data: message, error: msgError } = await serviceClient
      .from('chat_messages')
      .insert({
        thread_id: threadId,
        sender_id: user.id,
        content: safeContent,
        message_type: message_type || 'text',
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
