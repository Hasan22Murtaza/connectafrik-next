import type { NormalizedParticipant } from './participant';

export type ConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'failed';

export type RecordingState = 'idle' | 'starting' | 'recording' | 'stopping' | 'stopped';

export interface ScreenShareState {
  isActive: boolean;
  presenterId: string | null;
  presenterName: string;
  isLocalPresenting: boolean;
}

export interface NormalizedMeeting {
  id: string;
  connectionState: ConnectionState;
  localParticipant: NormalizedParticipant | null;
  remoteParticipants: NormalizedParticipant[];
  activeSpeakerId: string | null;
  screenShare: ScreenShareState;
  isGroupCall: boolean;
  participantCount: number;
}
