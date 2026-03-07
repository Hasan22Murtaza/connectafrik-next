export type CallDirection = 'incoming' | 'outgoing';

export type CallState =
  | 'idle'
  | 'initiating'
  | 'ringing'
  | 'accepting'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'ended'
  | 'failed';

export type CallActionType =
  | 'call_requested'
  | 'call_accepted'
  | 'call_rejected'
  | 'call_missed'
  | 'call_ended'
  | 'participant_joined'
  | 'participant_left'
  | 'reconnect_started'
  | 'reconnect_succeeded'
  | 'reconnect_failed'
  | 'media_permission_denied'
  | 'network_lost'
  | 'network_restored';

export type CallEndReason =
  | 'local_hangup'
  | 'remote_hangup'
  | 'rejected'
  | 'missed'
  | 'timeout_no_answer'
  | 'remote_disconnected_timeout'
  | 'network_failure'
  | 'media_error'
  | 'signaling_error'
  | 'token_expired'
  | 'unknown';

export type CallFailureStage =
  | 'create_room'
  | 'fetch_token'
  | 'join_meeting'
  | 'get_user_media'
  | 'publish_tracks'
  | 'subscribe_remote_tracks'
  | 'runtime';

export type CallNotificationType =
  | 'incoming_call'
  | 'missed_call'
  | 'call_accepted'
  | 'call_rejected'
  | 'call_ended';

export type CallMessageType =
  | 'call_request'
  | 'call_accepted'
  | 'call_rejected'
  | 'call_ended';

export const CALL_MESSAGE_TYPES: ReadonlyArray<CallMessageType> = [
  'call_request',
  'call_accepted',
  'call_rejected',
  'call_ended',
] as const;

export interface CallBehaviorMetadata {
  behaviorAction: CallActionType;
  behaviorDirection?: CallDirection;
  behaviorState?: CallState;
  behaviorEndReason?: CallEndReason;
  behaviorFailureStage?: CallFailureStage;
  behaviorAt?: string;
}
