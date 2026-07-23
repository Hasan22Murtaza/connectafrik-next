import type { SupabaseClient } from '@supabase/supabase-js'

export type PersistAcceptedOnAnotherDeviceParams = {
  threadId: string
  callId: string
  callType: 'audio' | 'video' | string
  calleeUserId: string
  acceptingSessionId: string
  roomId?: string
}

/**
 * Inserts a WhatsApp-style "Accepted on another device" row into `chat_messages`.
 * Visible only to the callee's other sessions (client filters via metadata).
 */
export async function persistAcceptedOnAnotherDeviceChatMessage(
  client: SupabaseClient,
  params: PersistAcceptedOnAnotherDeviceParams,
): Promise<{ inserted: boolean; messageId?: string }> {
  const { threadId, callId, callType, calleeUserId, acceptingSessionId, roomId } = params
  const normalizedCallType = String(callType).trim().toLowerCase() === 'video' ? 'video' : 'audio'

  const { data: existing } = await client
    .from('chat_messages')
    .select('id')
    .eq('thread_id', threadId)
    .eq('message_type', 'accepted_on_another_device')
    .eq('is_deleted', false)
    .contains('metadata', { callId })
    .maybeSingle()

  if (existing?.id) {
    return { inserted: false, messageId: existing.id }
  }

  const now = new Date().toISOString()
  const callTypeLabel = normalizedCallType === 'video' ? 'Video' : 'Voice'

  const { data: inserted, error: insertError } = await client
    .from('chat_messages')
    .insert({
      thread_id: threadId,
      sender_id: calleeUserId,
      content: 'Accepted on another device',
      message_type: 'accepted_on_another_device',
      metadata: {
        callId,
        callType: normalizedCallType,
        ...(roomId ? { roomId, room_id: roomId } : {}),
        for_user_id: calleeUserId,
        device_session_id: acceptingSessionId,
        acceptedOnAnotherDevice: true,
      },
    })
    .select('id')
    .single()

  if (insertError || !inserted?.id) {
    console.error('Failed to insert accepted_on_another_device chat message', insertError)
    return { inserted: false }
  }

  await client
    .from('chat_threads')
    .update({
      last_message_preview: `${callTypeLabel} call`,
      last_message_at: now,
      last_activity_at: now,
      updated_at: now,
    })
    .eq('id', threadId)

  return { inserted: true, messageId: inserted.id }
}
