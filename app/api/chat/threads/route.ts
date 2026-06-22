import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { queryUserThreads } from '@/lib/chatThreadsQuery'

/**
 * GET /api/chat/threads
 *
 * Returns the authenticated user's chat threads. Supports `limit`, `page`,
 * `category` (`general` | `marketplace`), `group_id`, and `filter`
 * (`all` | `unread` | `groups`) query params. See `lib/chatThreadsQuery.ts`.
 */
export async function GET(request: NextRequest) {
  try {
    const result = await queryUserThreads(request)
    return jsonResponse(result)
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to fetch threads', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const body = await request.json()
    const participantIds = body.participant_ids as string[] | undefined
    const type = (body.type as 'direct' | 'group') || 'direct'
    const title = body.title as string | undefined
    const name = body.name as string | undefined
    const rawGroupId = body.group_id
    const effectiveGroupId =
      typeof rawGroupId === 'string' && rawGroupId.trim().length > 0 ? rawGroupId.trim() : undefined

    if (!participantIds || !Array.isArray(participantIds)) {
      return errorResponse('participant_ids is required and must be an array', 400)
    }

    const allParticipantIds = [...new Set([user.id, ...participantIds])]
    const resolvedType = allParticipantIds.length > 2 ? 'group' : type

    if (resolvedType === 'group' && effectiveGroupId) {
      const { data: mem, error: memErr } = await serviceClient
        .from('group_memberships')
        .select('id')
        .eq('group_id', effectiveGroupId)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()

      if (memErr) return errorResponse(memErr.message, 400)
      if (!mem) return errorResponse('Not a member of this group', 403)

      const { data: existingGroupThread } = await serviceClient
        .from('chat_threads')
        .select('id')
        .eq('group_id', effectiveGroupId)
        .eq('type', 'group')
        .maybeSingle()

      if (existingGroupThread?.id) {
        const { data: part } = await serviceClient
          .from('chat_participants')
          .select('id')
          .eq('thread_id', existingGroupThread.id)
          .eq('user_id', user.id)
          .maybeSingle()

        if (!part) {
          const { error: addPartErr } = await serviceClient.from('chat_participants').insert({
            thread_id: existingGroupThread.id,
            user_id: user.id,
            role: 'member',
          })
          if (addPartErr) return errorResponse(addPartErr.message, 400)
        }
        return jsonResponse({ data: { id: existingGroupThread.id } }, 201)
      }
    }

    if (resolvedType === 'direct' && allParticipantIds.length === 2) {
      const { data: existingThreads } = await serviceClient
        .from('chat_threads')
        .select('id, chat_participants(user_id)')
        .eq('type', 'direct')

      if (existingThreads && existingThreads.length > 0) {
        const desiredIds = new Set(allParticipantIds)
        for (const thread of existingThreads as any[]) {
          const participantList = thread.chat_participants ?? []
          const threadUserIds = new Set(participantList.map((item: any) => item.user_id))
          if (threadUserIds.size === desiredIds.size && allParticipantIds.every((id) => threadUserIds.has(id))) {
            return jsonResponse({ data: { id: thread.id } }, 201)
          }
        }
      }
    }

    const insertRow: Record<string, unknown> = {
      type: resolvedType,
      title: title || null,
      name: name || title || null,
      created_by: user.id,
    }
    if (resolvedType === 'group' && effectiveGroupId) {
      insertRow.group_id = effectiveGroupId
    }

    const { data: thread, error: threadError } = await serviceClient
      .from('chat_threads')
      .insert(insertRow)
      .select()
      .single()

    if (threadError || !thread) {
      if (threadError?.code === '23505' && resolvedType === 'group' && effectiveGroupId) {
        const { data: existingGroupThread } = await serviceClient
          .from('chat_threads')
          .select('id')
          .eq('group_id', effectiveGroupId)
          .eq('type', 'group')
          .maybeSingle()

        if (existingGroupThread?.id) {
          const { data: part } = await serviceClient
            .from('chat_participants')
            .select('id')
            .eq('thread_id', existingGroupThread.id)
            .eq('user_id', user.id)
            .maybeSingle()

          if (!part) {
            const { error: addPartErr } = await serviceClient.from('chat_participants').insert({
              thread_id: existingGroupThread.id,
              user_id: user.id,
              role: 'member',
            })
            if (addPartErr) return errorResponse(addPartErr.message, 400)
          }
          return jsonResponse({ data: { id: existingGroupThread.id } }, 201)
        }
      }
      return errorResponse(threadError?.message || 'Failed to create thread', 400)
    }

    const participants = allParticipantIds.map((userId) => ({
      thread_id: thread.id,
      user_id: userId,
      role: userId === user.id ? 'admin' : 'member',
    }))

    const { error: insertPartError } = await serviceClient
      .from('chat_participants')
      .insert(participants)

    if (insertPartError) {
      await serviceClient.from('chat_threads').delete().eq('id', thread.id)
      return errorResponse(insertPartError.message, 400)
    }

    return jsonResponse({ data: { id: thread.id } }, 201)
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to create thread', 500)
  }
}
