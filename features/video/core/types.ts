export type CallStatus = 'connecting' | 'ringing' | 'connecting_media' | 'connected' | 'ended';
export type SpeakerLevel = 'normal' | 'low' | 'loud';

/** Props for the call entry surface (`features/video/CallModal.tsx`). */
export interface CallModalProps {
  isOpen: boolean;
  onClose: () => void;
  callType: 'audio' | 'video';
  callerName: string;
  recipientName: string;
  callerAvatarUrl?: string;
  recipientAvatarUrl?: string;
  isGroupCallHint?: boolean;
  isIncoming?: boolean;
  onAccept?: () => void;
  onReject?: () => void;
  onCallEnd?: () => void;
  threadId?: string;
  currentUserId?: string;
  roomIdHint?: string;
  tokenHint?: string;
  callIdHint?: string;
  /** Staged from `/api/videosdk/room` when using LiveKit. */
  mediaProviderHint?: 'livekit' | 'videosdk';
  wsUrlHint?: string;
}

/** @deprecated Use `CallModalProps` */
export type VideoSDKCallModalProps = CallModalProps;

export const SPEAKER_VOLUMES: Record<SpeakerLevel, number> = {
  normal: 0.85,
  loud: 1,
  low: 0.3,
};
