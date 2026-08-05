export type CallStatus =
  | 'connecting'
  | 'ringing'
  | 'connecting_media'
  | 'connected'
  | 'ended';

export type CallType = 'audio' | 'video';

export interface CallSession {
  callId: string;
  threadId: string;
  roomId: string;
  callType: CallType;
  isIncoming: boolean;
  isGroupCall: boolean;
  hostId: string | null;
}
