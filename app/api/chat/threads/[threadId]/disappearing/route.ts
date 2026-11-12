import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { requireChatThreadAccess } from '@/lib/chat/chatThreadAccess'
import { requireUnlockedLockedThread } from '@/lib/chat/chatLock'
import {
  CHAT_THREAD_DETAIL_SELECT,
  getMyThreadParticipantPrefs,
  threadToResponseBody,
} from '@/lib/chat/chatThreadDetail'
import {
  insertDisappearingSystemMessage,
  normalizeDisappearingDurationSec,
} from '@/lib/chat/chatDisappearingMessages'
import { getThreadBlockState, blockStateErrorMessage } from '@/lib/chat/chatThreadBlock'

type RouteContext = { params: Promise<{ threadId: string }> }

/**
 * POST /api/chat/threads/:threadId/disappearing
 * Body: { duration_sec: 0 | 86400 | 604800 | 7776000 }
 *
 * Anyone in the chat can change disappearing messages; a system line is posted.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { threadId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()

    const allowed = await requireChatThreadAccess(serviceClient, user.id, threadId)
    if (!allowed) {
      return errorResponse('Thread not found or access denied', 404)
    }

    const lockedDenial = await requireUnlockedLockedThread(
      request,
      serviceClient,
      user.id,
      threadId
    )
    if (lockedDenial) return lockedDenial

    const blockState = await getThreadBlockState(serviceClient, threadId, user.id)
    const blockMessage = blockStateErrorMessage(blockState)
    if (blockMessage) {
      return errorResponse(blockMessage, 403)
    }

    const payload = await request.json().catch(() => ({}))
    const hasDuration =
      payload?.duration_sec !== undefined || payload?.disappearing_duration_sec !== undefined
    if (!hasDuration) {
      return errorResponse('duration_sec is required', 400)
    }

    const raw =
      payload.duration_sec !== undefined
        ? payload.duration_sec
        : payload.disappearing_duration_sec
    const offRequested =
      raw === 0 || raw === '0' || raw === null || raw === '' || raw === false
    const durationSec = offRequested ? null : normalizeDisappearingDurationSec(raw)
    if (!offRequested && durationSec === null) {
      return errorResponse('duration_sec must be Off, 24 hours, 7 days, or 90 days', 400)
    }

    const { data: existing, error: existingErr } = await serviceClient
      .from('chat_threads')
      .select('id, disappearing_duration_sec')
      .eq('id', threadId)
      .single()

    if (existingErr || !existing) {
      return errorResponse(existingErr?.message || 'Thread not found', 404)
    }

    const prev = normalizeDisappearingDurationSec(existing.disappearing_duration_sec)
    if (prev === durationSec) {
      const { data: thread } = await serviceClient
        .from('chat_threads')
        .select(CHAT_THREAD_DETAIL_SELECT)
        .eq('id', threadId)
        .single()
      const prefs = await getMyThreadParticipantPrefs(serviceClient, user.id, threadId)
      return jsonResponse(
        threadToResponseBody((thread || existing) as Record<string, unknown>, prefs)
      )
    }

    const now = new Date().toISOString()
    const { data: updated, error: updateErr } = await serviceClient
      .from('chat_threads')
      .update({
        disappearing_duration_sec: durationSec,
        updated_at: now,
      })
      .eq('id', threadId)
      .select(CHAT_THREAD_DETAIL_SELECT)
      .single()

    if (updateErr || !updated) {
      return errorResponse(updateErr?.message || 'Failed to update disappearing messages', 400)
    }

    let systemMessage: Record<string, unknown> | null = null
    try {
      const inserted = await insertDisappearingSystemMessage(serviceClient, {
        threadId,
        actorUserId: user.id,
        durationSec,
      })
      if (inserted) {
        const { data: profile } = await serviceClient
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .eq('id', user.id)
          .maybeSingle()
        systemMessage = {
          ...inserted,
          read_by: [user.id],
          attachments: [],
          reactions: [],
          sender: profile
            ? {
                id: profile.id,
                username: profile.username,
                full_name: profile.full_name,
                avatar_url: profile.avatar_url,
              }
            : { id: user.id },
        }
      }
    } catch (msgErr) {
      console.error('Disappearing messages: system message failed', msgErr)
    }

    const prefs = await getMyThreadParticipantPrefs(serviceClient, user.id, threadId)
    const threadResponse = threadToResponseBody(updated as Record<string, unknown>, prefs)
    return jsonResponse({
      ...threadResponse,
      system_message: systemMessage,
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to update disappearing messages', 500)
  }
}
