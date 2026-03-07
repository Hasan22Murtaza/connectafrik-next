import type { CallActionType, CallEndReason, CallNotificationType } from '@/shared/types/call'

export interface NormalizedCallBehavior {
  callType: 'audio' | 'video'
  behaviorAction: CallActionType | null
  behaviorEndReason: CallEndReason | null
}

const toObject = (value: unknown): Record<string, unknown> => {
  if (!value) return {}
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      return {}
    }
  }
  return {}
}

const readString = (obj: Record<string, unknown>, keys: string[]): string | null => {
  for (const key of keys) {
    const val = obj[key]
    if (typeof val === 'string' && val.trim()) return val
  }
  return null
}

const ALLOWED_CALL_ACTIONS: CallActionType[] = [
  'call_requested',
  'call_accepted',
  'call_rejected',
  'call_missed',
  'call_ended',
  'participant_joined',
  'participant_left',
  'reconnect_started',
  'reconnect_succeeded',
  'reconnect_failed',
  'media_permission_denied',
  'network_lost',
  'network_restored',
]

const ALLOWED_CALL_END_REASONS: CallEndReason[] = [
  'local_hangup',
  'remote_hangup',
  'rejected',
  'missed',
  'timeout_no_answer',
  'remote_disconnected_timeout',
  'network_failure',
  'media_error',
  'signaling_error',
  'token_expired',
  'unknown',
]

export const normalizeCallBehavior = (metadata: unknown): NormalizedCallBehavior => {
  const meta = toObject(metadata)
  const rawCallType = readString(meta, ['callType', 'call_type'])
  const callType: 'audio' | 'video' = rawCallType === 'video' ? 'video' : 'audio'
  const rawAction = readString(meta, ['behaviorAction', 'behavior_action'])
  const rawEndReason = readString(meta, ['behaviorEndReason', 'behavior_end_reason'])
  const behaviorAction = rawAction && ALLOWED_CALL_ACTIONS.includes(rawAction as CallActionType)
    ? (rawAction as CallActionType)
    : null
  const behaviorEndReason = rawEndReason && ALLOWED_CALL_END_REASONS.includes(rawEndReason as CallEndReason)
    ? (rawEndReason as CallEndReason)
    : null

  return {
    callType,
    behaviorAction,
    behaviorEndReason,
  }
}

export const normalizeCallMetadata = (metadata: unknown): Record<string, unknown> => {
  return toObject(metadata)
}

export const normalizeCallNotificationType = (value: unknown): CallNotificationType | null => {
  if (typeof value !== 'string') return null
  const allowed: CallNotificationType[] = [
    'incoming_call',
    'missed_call',
    'call_accepted',
    'call_rejected',
    'call_ended',
  ]
  return allowed.includes(value as CallNotificationType) ? (value as CallNotificationType) : null
}
