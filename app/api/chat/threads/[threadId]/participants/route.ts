import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { requireChatThreadAccess } from '@/lib/chat/chatThreadAccess'
import { isChatAdminRole } from '@/lib/chat/chatThreadAdmin'

type ParticipantRow = {
  user_id: string
  role: string | null
  user?:
    | {
        id: string
        username: string | null
        full_name: string | null
        avatar_url: string | null
      }
    | {
        id: string
        username: string | null
        full_name: string | null
        avatar_url: string | null
      }[]
    | null
}

function profileFromRow(row: ParticipantRow) {
  const raw = row.user
  if (Array.isArray(raw)) return raw[0] ?? null
  return raw ?? null
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()

    const allowed = await requireChatThreadAccess(serviceClient, user.id, threadId)
    if (!allowed) {
      return errorResponse('Thread not found or access denied', 404)
    }

    const excludeUserId = request.nextUrl.searchParams.get('exclude_user_id')

    const { data: thread } = await serviceClient
      .from('chat_threads')
      .select('created_by, type')
      .eq('id', threadId)
      .maybeSingle()

    let query = serviceClient
      .from('chat_participants')
      .select(
        'user_id, role, user:profiles!user_id(id, username, full_name, avatar_url)'
      )
      .eq('thread_id', threadId)

    if (excludeUserId) {
      query = query.neq('user_id', excludeUserId)
    }

    const { data: participants, error } = await query

    if (error) {
      // Fallback without profile join if FK hint fails
      const { data: plain, error: plainErr } = await serviceClient
        .from('chat_participants')
        .select('user_id, role')
        .eq('thread_id', threadId)
      if (plainErr) return errorResponse(error.message, 400)

      const creatorId =
        typeof thread?.created_by === 'string' ? thread.created_by : null
      const hasAdmin = (plain || []).some((r) => isChatAdminRole(r.role))
      if (creatorId && !hasAdmin) {
        await serviceClient
          .from('chat_participants')
          .update({ role: 'admin' })
          .eq('thread_id', threadId)
          .eq('user_id', creatorId)
      }

      const rows = (plain || [])
        .filter((r) => !excludeUserId || r.user_id !== excludeUserId)
        .map((row) => ({
          user_id: row.user_id,
          role:
            creatorId &&
            row.user_id === creatorId &&
            !isChatAdminRole(row.role)
              ? 'admin'
              : (row.role || 'member').toLowerCase(),
          name: 'User',
          username: null as string | null,
          avatar_url: null as string | null,
        }))

      return jsonResponse(rows)
    }

    const creatorId =
      typeof thread?.created_by === 'string' ? thread.created_by : null
    const hasAdmin = ((participants || []) as ParticipantRow[]).some((r) =>
      isChatAdminRole(r.role)
    )

    // Older chat groups may have no admin row — promote the creator once.
    if (creatorId && !hasAdmin) {
      await serviceClient
        .from('chat_participants')
        .update({ role: 'admin' })
        .eq('thread_id', threadId)
        .eq('user_id', creatorId)
    }

    const rows = ((participants || []) as ParticipantRow[]).map((row) => {
      const profile = profileFromRow(row)
      const roleRaw = (row.role || 'member').toLowerCase()
      const role =
        creatorId && row.user_id === creatorId && !hasAdmin
          ? 'admin'
          : roleRaw
      return {
        user_id: row.user_id,
        role,
        name:
          profile?.full_name?.trim() ||
          profile?.username?.trim() ||
          'User',
        username: profile?.username ?? null,
        avatar_url: profile?.avatar_url ?? null,
      }
    })

    return jsonResponse(rows)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Internal server error', 500)
  }
}
