import type { ReactNode } from 'react';
import type { CallMediaProviderName } from '@/lib/call-media/types';
import type { NormalizedParticipant, NormalizedMeeting } from '../models';
import type { MeetingEventBus } from '../events';

export interface InviteParticipantOptions {
  userId: string;
  displayName?: string;
}

export interface SendMessageOptions {
  content: string;
  threadId: string;
}

/** Provider contract — UI and orchestration call only these methods. */
export interface CallMediaProviderAdapter {
  readonly name: CallMediaProviderName;
  readonly meeting: NormalizedMeeting;
  readonly events: MeetingEventBus;

  joinMeeting(): Promise<void>;
  leaveMeeting(): Promise<void>;
  toggleMic(): Promise<void>;
  toggleCamera(): Promise<void>;
  switchSpeaker(level: 'normal' | 'low' | 'loud'): void;
  startScreenShare(): Promise<void>;
  stopScreenShare(): Promise<void>;
  sendMessage(options: SendMessageOptions): Promise<void>;
  addParticipants(options: InviteParticipantOptions[]): Promise<void>;
  removeParticipant(participantId: string): Promise<void>;
  muteParticipant(participantId: string): Promise<void>;
  pinParticipant(participantId: string | null): void;
  getParticipants(): NormalizedParticipant[];
  getLocalParticipant(): NormalizedParticipant | null;
  getActiveSpeaker(): NormalizedParticipant | null;
  reconnect(): Promise<void>;
  endMeeting(): Promise<void>;

  /** Render provider-specific media for a participant tile. */
  renderParticipantMedia(
    participantId: string,
    options: ParticipantMediaOptions,
  ): ReactNode;

  /** Render provider-specific screen share track. */
  renderScreenShareMedia(
    presenterId: string,
    options: ScreenShareMediaOptions,
  ): ReactNode;
}

export interface ParticipantMediaOptions {
  isLocal?: boolean;
  audioOnly?: boolean;
  audioVolume?: number;
  tileCount?: number;
  showNameLabel?: boolean;
  mirrorLocal?: boolean;
}

export interface ScreenShareMediaOptions {
  objectFit?: 'contain' | 'cover';
}

export interface CallMediaProviderConnectOptions {
  meetingId: string;
  token: string;
  wsUrl?: string;
  displayName: string;
  callType: 'audio' | 'video';
  metadata?: Record<string, unknown>;
}
