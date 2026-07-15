import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { requireChatThreadAccess } from '@/lib/chatThreadAccess'
import { DeepSeekError } from '@/lib/deepseek'
import {
  fetchThreadDialogueForTranscript,
  generateTranscriptWithDeepSeek,
  getSavedTranscript,
  upsertTranscript,
} from '@/lib/chatTranscript'

type RouteContext = { params: Promise<{ threadId: string }> }

function transcriptResponse(row: {
  id: string
  content: string
  source_message_count: number
  source_last_message_at: string | null
  model: string | null
  created_at: string
  updated_at: string
}, cached: boolean) {
  return {
    id: row.id,
    content: row.content,
    cached,
    source_message_count: row.source_message_count,
    source_last_message_at: row.source_last_message_at,
    model: row.model,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { threadId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()

    const allowed = await requireChatThreadAccess(serviceClient, user.id, threadId)
    if (!allowed) {
      return errorResponse('Thread not found or access denied', 404)
    }

    let refresh = false
    try {
      const body = await request.json()
      refresh = Boolean(body?.refresh)
    } catch {
      refresh = false
    }

    if (!refresh) {
      const existing = await getSavedTranscript(serviceClient, threadId)
      if (existing) {
        return jsonResponse(transcriptResponse(existing, true))
      }
    }

    const { lines, messageCount, lastMessageAt } = await fetchThreadDialogueForTranscript(
      serviceClient,
      threadId,
      user.id
    )

    if (lines.length === 0) {
      return errorResponse('No messages available to generate a transcript', 400)
    }

    const { content, model } = await generateTranscriptWithDeepSeek(lines)
    const saved = await upsertTranscript(serviceClient, {
      threadId,
      userId: user.id,
      content,
      sourceMessageCount: messageCount,
      sourceLastMessageAt: lastMessageAt,
      model,
    })

    return jsonResponse(transcriptResponse(saved, false))
  } catch (error: unknown) {
    const err = error as { message?: string; status?: number; name?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    if (err.name === 'DeepSeekError' || error instanceof DeepSeekError) {
      const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 502
      return errorResponse(err.message || 'Failed to generate transcript', status === 401 ? 502 : status)
    }
    return errorResponse(err.message || 'Failed to generate transcript', 500)
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { threadId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()

    const allowed = await requireChatThreadAccess(serviceClient, user.id, threadId)
    if (!allowed) {
      return errorResponse('Thread not found or access denied', 404)
    }

    const existing = await getSavedTranscript(serviceClient, threadId)
    if (!existing) {
      return errorResponse('No transcript saved for this conversation', 404)
    }

    return jsonResponse(transcriptResponse(existing, true))
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to load transcript', 500)
  }
}
