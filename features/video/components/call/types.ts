export type CallStatus = 'connecting' | 'ringing' | 'connected' | 'ended';
export type SpeakerLevel = 'normal' | 'low' | 'loud';

export type {
  CallActionType,
  CallBehaviorMetadata,
  CallDirection,
  CallEndReason,
  CallFailureStage,
  CallNotificationType,
  CallState,
} from '@/shared/types/call';

export interface VideoSDKCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  callType: 'audio' | 'video';
  callerName: string;
  recipientName: string;
  isIncoming?: boolean;
  onAccept?: () => void;
  onReject?: () => void;
  onCallEnd?: () => void;
  threadId?: string;
  currentUserId?: string;
  roomIdHint?: string;
  tokenHint?: string;
  callIdHint?: string;
}

export const SPEAKER_VOLUMES: Record<SpeakerLevel, number> = {
  normal: 0.85,
  loud: 1,
  low: 0.3,
};
