/** Normalized participant — UI never sees raw SDK objects. */
export interface NormalizedParticipant {
  id: string;
  displayName: string;
  isLocal: boolean;
  isMicOn: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  isActiveSpeaker: boolean;
  avatarUrl: string;
  metadata?: Record<string, unknown>;
}

export function participantInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}
