/**
 * Call-related FCM / push notification `data` fields (stringified in transit).
 * Kept separate from persisted notification rows for reuse across API + clients.
 */
export interface CallPushNotificationData {
  type?: string
  call_type?: 'audio' | 'video' | string
  thread_id?: string
  threadId?: string
  call_id?: string
  callId?: string
  room_id?: string
  /**
   * When `true`, the callee accepted this incoming call on another device belonging
   * to the same account. Receiving clients should dismiss ringing UI immediately.
   * Omitted for callers and for the device that accepted (backward-compatible).
   */
  acceptedOnAnotherDevice?: boolean | string
  /** Auth session UUID of the device that accepted/declined (JWT `session_id`). */
  device_session_id?: string
  device_session_label?: string
}

/** Parse FCM string booleans (`"true"` / `"false"`). */
export function parsePushBooleanFlag(value: unknown): boolean {
  if (value === true || value === 1) return true
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return normalized === 'true' || normalized === '1'
  }
  return false
}

export function isAcceptedOnAnotherDevicePush(data: Record<string, unknown> | undefined | null): boolean {
  if (!data || typeof data !== 'object') return false
  return parsePushBooleanFlag(data.acceptedOnAnotherDevice)
}

/** Callee-only chat row: hide from other participants and from the device that accepted. */
export function shouldShowAcceptedOnAnotherDeviceMessage(
  message: { message_type?: string; metadata?: Record<string, unknown> },
  currentUserId: string | null | undefined,
  localSessionId: string | null | undefined,
): boolean {
  const mt = (message.message_type || '').toLowerCase()
  if (mt !== 'accepted_on_another_device') return true

  const forUser = message.metadata?.for_user_id
  if (forUser && currentUserId && String(forUser).trim() !== String(currentUserId).trim()) {
    return false
  }

  const acceptingSession =
    typeof message.metadata?.device_session_id === 'string'
      ? message.metadata.device_session_id.trim()
      : ''
  const localSession = typeof localSessionId === 'string' ? localSessionId.trim() : ''
  if (acceptingSession && localSession && acceptingSession === localSession) {
    return false
  }

  return true
}
