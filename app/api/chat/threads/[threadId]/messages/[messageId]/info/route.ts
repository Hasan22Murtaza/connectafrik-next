import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { requireChatThreadAccess } from '@/lib/chatThreadAccess'

const MESSAGE_SELECT = `
  *,
  sender:profiles!chat_messages_sender_id_fkey(id, username, full_name, avatar_url)
`

type RouteContext = { params: Promise<{ threadId: string; messageId: string }> }

type ReadRow = { user_id: string; created_at?: string | null }
type ProfileRow = { id: string; username: string | null; full_name: string | null; avatar_url: string | null }
type ParticipantRow = { user_id: string; user?: ProfileRow | ProfileRow[] | null }

const REPLY_PREVIEW_MAX = 280

const formatReactions = (rows: { emoji: string; user_id: string }[] | null, currentUserId: string) => {
  const reactionMap = new Map<string, { count: number; user_reacted: boolean }>()
  for (const reaction of rows || []) {
    const existing = reactionMap.get(reaction.emoji) || { count: 0, user_reacted: false }
    reactionMap.set(reaction.emoji, {
      count: existing.count + 1,
      user_reacted: existing.user_reacted || reaction.user_id === currentUserId,
    })
  }
  return Array.from(reactionMap.entries())
    .map(([emoji, details]) => ({
      emoji,
      count: details.count,
      user_reacted: details.user_reacted,
    }))
    .sort((a, b) => b.count - a.count)
}

const getJoinedProfile = (participant: ParticipantRow): ProfileRow | null => {
  if (Array.isArray(participant.user)) return participant.user[0] ?? null
  return participant.user ?? null
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { threadId, messageId } = await context.params
    const { user } = await getAuthenticatedUser(_request)
    const serviceClient = createServiceClient()

    const allowed = await requireChatThreadAccess(serviceClient, user.id, threadId)
    if (!allowed) {
      return errorResponse('Thread not found or access denied', 404)
    }

    const { data: message, error: msgError } = await serviceClient
      .from('chat_messages')
      .select(MESSAGE_SELECT)
      .eq('id', messageId)
      .eq('thread_id', threadId)
      .maybeSingle()

    if (msgError) return errorResponse(msgError.message, 400)
    if (!message) return errorResponse('Message not found', 404)

    const senderId = message.sender_id as string
    const canDelete = senderId === user.id && !Boolean((message as { is_deleted?: boolean }).is_deleted)

    const replyId = (message as { reply_to_id?: string | null }).reply_to_id
    const replyRowPromise = (async () => {
      if (!replyId) return { data: null as any, error: null as any }
      return serviceClient
        .from('chat_messages')
        .select(
          `
          id,
          content,
          is_deleted,
          sender:profiles!chat_messages_sender_id_fkey(id, username, full_name, avatar_url)
        `
        )
        .eq('id', replyId)
        .eq('thread_id', threadId)
        .maybeSingle()
    })()

    const [readsRes, attachmentsRes, reactionsRes, participantsRes, replyRes] = await Promise.all([
      serviceClient.from('message_reads').select('*').eq('message_id', messageId),
      serviceClient.from('message_attachments').select('*').eq('message_id', messageId),
      serviceClient.from('message_reactions').select('message_id, emoji, user_id').eq('message_id', messageId),
      serviceClient
        .from('chat_participants')
        .select('user_id, user:profiles!user_id(id, username, full_name, avatar_url)')
        .eq('thread_id', threadId),
      replyRowPromise,
    ])

    if (readsRes.error) return errorResponse(readsRes.error.message, 400)
    if (attachmentsRes.error) return errorResponse(attachmentsRes.error.message, 400)
    if (reactionsRes.error) return errorResponse(reactionsRes.error.message, 400)
    if (participantsRes.error) return errorResponse(participantsRes.error.message, 400)
    if (replyId && replyRes.error) return errorResponse(replyRes.error.message, 400)

    const readRows = (readsRes.data || []) as ReadRow[]
    const readBy = readRows.map((r) => r.user_id)
    const reactions = formatReactions(reactionsRes.data || [], user.id)
    const readUserIds = new Set(readBy)
    const participantRows = (participantsRes.data || []) as ParticipantRow[]

    const readReceiptUserIds = [
      ...new Set(
        readRows
          .map((r) => r.user_id)
          .filter((id) => id && id !== senderId)
      ),
    ]

    let profileById = new Map<string, ProfileRow>()
    for (const participant of participantRows) {
      const joinedProfile = getJoinedProfile(participant)
      if (joinedProfile?.id) {
        profileById.set(joinedProfile.id, joinedProfile)
      }
    }
    const missingReadProfileIds = readReceiptUserIds.filter((id) => !profileById.has(id))
    if (missingReadProfileIds.length > 0) {
      const { data: profiles } = await serviceClient
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', missingReadProfileIds)
      for (const p of profiles || []) {
        profileById.set(p.id, p)
      }
    }

    const readAt = (r: ReadRow) => (r.created_at as string | undefined) ?? null
    const toReceiptUser = (profile: ProfileRow | undefined | null) =>
      profile
        ? {
            id: profile.id,
            username: profile.username,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
            display_name: profile.full_name || profile.username || 'Unknown',
          }
        : null

    const read_receipts = readRows
      .filter((r) => r.user_id && r.user_id !== senderId)
      .map((r) => {
        const p = profileById.get(r.user_id)
        return {
          user_id: r.user_id,
          read_at: readAt(r),
          user: toReceiptUser(p),
        }
      })
      .sort((a, b) => {
        const ta = a.read_at ? new Date(a.read_at).getTime() : 0
        const tb = b.read_at ? new Date(b.read_at).getTime() : 0
        return ta - tb
      })

    const delivered_receipts = participantRows
      .filter((participant) => {
        const id = participant.user_id
        return id && id !== senderId && !readUserIds.has(id)
      })
      .map((participant) => ({
        user_id: participant.user_id,
        delivered_at: (message.created_at as string | undefined) ?? null,
        user: toReceiptUser(profileById.get(participant.user_id) ?? getJoinedProfile(participant)),
      }))
      .sort((a, b) => {
        const aName = a.user?.display_name || ''
        const bName = b.user?.display_name || ''
        return aName.localeCompare(bName)
      })

    const sent_at = (message.created_at as string | undefined) ?? null
    const latest_read_at =
      read_receipts.length > 0 ? read_receipts[read_receipts.length - 1]?.read_at ?? null : null
    const latest_delivered_at =
      delivered_receipts.length > 0 ? delivered_receipts[0]?.delivered_at ?? null : null

    let reply_to: {
      message_id: string
      content_preview: string
      is_deleted: boolean
      sender: {
        id: string
        username: string | null
        full_name: string | null
        avatar_url: string | null
        display_name: string
      } | null
    } | null = null

    const quoted = replyRes?.data ?? null
    if (quoted?.id) {
      const raw = typeof quoted.content === 'string' ? quoted.content : ''
      const preview =
        raw.length > REPLY_PREVIEW_MAX ? `${raw.slice(0, REPLY_PREVIEW_MAX - 1)}…` : raw
      const s = quoted.sender
      reply_to = {
        message_id: quoted.id,
        content_preview: quoted.is_deleted ? '' : preview,
        is_deleted: Boolean(quoted.is_deleted),
        sender: s
          ? {
              id: s.id,
              username: s.username ?? null,
              full_name: s.full_name ?? null,
              avatar_url: s.avatar_url ?? null,
              display_name: s.full_name || s.username || 'Unknown',
            }
          : null,
      }
    }

    return jsonResponse({
      ...message,
      read_by: readBy,
      attachments: attachmentsRes.data || [],
      reactions,
      reply_to,
      read_receipts,
      delivered_receipts,
      sent_at,
      latest_read_at,
      latest_delivered_at,
      read_count: read_receipts.length,
      delivered_count: delivered_receipts.length,
      receipt_total: read_receipts.length + delivered_receipts.length,
      can_delete_for_everyone: canDelete,
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to load message info', 500)
  }
}
