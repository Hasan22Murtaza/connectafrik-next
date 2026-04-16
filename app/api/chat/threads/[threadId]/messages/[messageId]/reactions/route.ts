import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getReactionEmoji } from '@/shared/utils/reactionUtils'

type RouteContext = { params: Promise<{ threadId: string; messageId: string }> }

type ReactionRow = { user_id: string | null; emoji: string; created_at: string | null }

type ProfileRow = { id: string; username: string | null; full_name: string | null; avatar_url: string | null }

function resolveEmojiFromBody(body: { emoji?: unknown; reaction_type?: unknown }): string | null {
  if (typeof body.emoji === 'string' && body.emoji.trim()) {
    return body.emoji.trim()
  }
  if (typeof body.reaction_type === 'string' && body.reaction_type.trim()) {
    return getReactionEmoji(body.reaction_type.trim())
  }
  return null
}

async function assertThreadParticipant(
  serviceClient: ReturnType<typeof createServiceClient>,
  threadId: string,
  userId: string
) {
  const { data: participant } = await serviceClient
    .from('chat_participants')
    .select('id')
    .eq('thread_id', threadId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!participant) {
    return { ok: false as const, status: 404, message: 'Thread not found or access denied' }
  }
  return { ok: true as const }
}

async function assertMessageInThread(
  serviceClient: ReturnType<typeof createServiceClient>,
  threadId: string,
  messageId: string
) {
  const { data: msg, error } = await serviceClient
    .from('chat_messages')
    .select('id')
    .eq('id', messageId)
    .eq('thread_id', threadId)
    .eq('is_deleted', false)
    .maybeSingle()

  if (error) return { ok: false as const, status: 400, message: error.message }
  if (!msg) return { ok: false as const, status: 404, message: 'Message not found' }
  return { ok: true as const }
}

async function buildGroupedReactions(
  serviceClient: ReturnType<typeof createServiceClient>,
  messageId: string,
  userId: string | null
) {
  const { data: reactionsData, error } = await serviceClient
    .from('message_reactions')
    .select('user_id, emoji, created_at')
    .eq('message_id', messageId)
    .order('created_at', { ascending: false })

  if (error) return { error: error.message, groups: null as null, summary: null as null }

  const rows = (reactionsData || []) as ReactionRow[]
  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[]

  let profileMap = new Map<string, ProfileRow>()
  if (userIds.length > 0) {
    const { data: profiles } = await serviceClient
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', userIds)
    if (profiles) {
      profileMap = new Map((profiles as ProfileRow[]).map((p) => [p.id, p]))
    }
  }

  const groups: Record<
    string,
    { emoji: string; count: number; users: ProfileRow[]; currentUserReacted: boolean }
  > = {}
  let totalCount = 0

  for (const r of rows) {
    if (!r.emoji || !r.user_id) continue
    if (!groups[r.emoji]) {
      groups[r.emoji] = { emoji: r.emoji, count: 0, users: [], currentUserReacted: false }
    }
    groups[r.emoji].count++
    totalCount++

    const profile = profileMap.get(r.user_id)
    if (profile && !groups[r.emoji].users.find((u: { id: string }) => u.id === profile.id)) {
      groups[r.emoji].users.push(profile)
    }
    if (userId && r.user_id === userId) {
      groups[r.emoji].currentUserReacted = true
    }
  }

  const groupedArray = Object.values(groups).sort((a, b) => b.count - a.count)
  const summary = groupedArray.map((g) => ({
    emoji: g.emoji,
    count: g.count,
    user_reacted: g.currentUserReacted,
  }))

  return { error: null as null, groups: groupedArray, summary }
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { threadId, messageId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const userId = user.id
    const serviceClient = createServiceClient()

    const part = await assertThreadParticipant(serviceClient, threadId, user.id)
    if (!part.ok) return errorResponse(part.message, part.status)

    const msgCheck = await assertMessageInThread(serviceClient, threadId, messageId)
    if (!msgCheck.ok) return errorResponse(msgCheck.message, msgCheck.status)

    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')

    if (limitParam) {
      const limit = Math.min(Math.max(parseInt(limitParam, 10) || 20, 1), 50)
      const page = Math.max(parseInt(searchParams.get('page') || '0', 10) || 0, 0)
      const from = page * limit
      const to = from + limit - 1
      const emojiFilter = searchParams.get('emoji')

      let query = serviceClient
        .from('message_reactions')
        .select('user_id, emoji, created_at')
        .eq('message_id', messageId)
        .order('created_at', { ascending: false })

      if (emojiFilter) {
        query = query.eq('emoji', emojiFilter)
      }

      query = query.range(from, to)

      const { data: reactionsData, error } = await query
      if (error) return errorResponse(error.message, 400)

      const rows = (reactionsData || []) as ReactionRow[]
      const uids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[]

      let profileMap = new Map<string, any>()
      if (uids.length > 0) {
        const { data: profiles } = await serviceClient
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .in('id', uids)
        if (profiles) {
          profileMap = new Map(profiles.map((p: any) => [p.id, p]))
        }
      }

      const items = rows
        .filter((r) => r.user_id && profileMap.has(r.user_id))
        .map((r) => ({
          emoji: r.emoji,
          user: profileMap.get(r.user_id!),
        }))

      return jsonResponse({ data: items, page, pageSize: limit, hasMore: rows.length === limit })
    }

    const { groups, summary, error } = await buildGroupedReactions(serviceClient, messageId, userId)
    if (error) return errorResponse(error, 400)

    const totalCount = summary?.reduce((acc, s) => acc + s.count, 0) ?? 0
    return jsonResponse({ data: groups, summary, totalCount })
  } catch (err: unknown) {
    const e = err as { message?: string }
    if (e.message === 'Unauthorized' || e.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(e.message || 'Failed to fetch reactions', 500)
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { threadId, messageId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const body = await request.json()
    const emoji = resolveEmojiFromBody(body)

    if (!emoji) {
      return errorResponse('emoji or reaction_type is required', 400)
    }

    const part = await assertThreadParticipant(serviceClient, threadId, user.id)
    if (!part.ok) return errorResponse(part.message, part.status)

    const msgCheck = await assertMessageInThread(serviceClient, threadId, messageId)
    if (!msgCheck.ok) return errorResponse(msgCheck.message, msgCheck.status)

    const { data: existing } = await serviceClient
      .from('message_reactions')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', user.id)
      .eq('emoji', emoji)
      .maybeSingle()

    let action: 'added' | 'removed'

    if (existing?.id) {
      const { error: delErr } = await serviceClient.from('message_reactions').delete().eq('id', existing.id)
      if (delErr) return errorResponse(delErr.message, 400)
      action = 'removed'
    } else {
      const { error: insErr } = await serviceClient.from('message_reactions').insert({
        message_id: messageId,
        user_id: user.id,
        emoji,
      })
      if (insErr) return errorResponse(insErr.message, 400)
      action = 'added'
    }

    const built = await buildGroupedReactions(serviceClient, messageId, user.id)
    if (built.error) return errorResponse(built.error, 400)

    const totalCount = built.summary?.reduce((acc, s) => acc + s.count, 0) ?? 0
    return jsonResponse({
      action,
      emoji,
      reactions: built.summary ?? [],
      totalCount,
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to handle reaction', 500)
  }
}
