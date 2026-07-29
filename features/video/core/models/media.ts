export type MediaTrackKind = 'audio' | 'video' | 'screen';

export interface MediaPermissions {
  microphone: PermissionState | 'unknown';
  camera: PermissionState | 'unknown';
}

export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';

/** Opaque handle — providers attach real tracks internally. */
export interface MediaTrackRef {
  participantId: string;
  kind: MediaTrackKind;
  source: 'camera' | 'microphone' | 'screen';
}
