export type CallMediaProviderName = 'livekit' | 'videosdk';

/** Credentials returned by room/token APIs — same contract for both providers. */
export interface CallMediaCredentials {
  roomId: string;
  token: string;
  provider: CallMediaProviderName;
  /** LiveKit WebSocket URL (wss://…). Omitted for VideoSDK. */
  wsUrl?: string;
  userId?: string;
  expiresIn?: string;
}

export interface CreateCallRoomOptions {
  userId: string;
  includeParticipantToken?: boolean;
  /** Caller's display name/avatar — stamped onto the LiveKit participant at join. */
  displayName?: string;
  avatarUrl?: string;
}

export interface IssueCallTokenOptions {
  roomId: string;
  userId: string;
  displayName?: string;
  /** LiveKit stores this as participant metadata so remote tiles can show a real photo, not initials. */
  avatarUrl?: string;
  /** Pin to the provider the room was actually created on, bypassing auto-resolution. */
  provider?: CallMediaProviderName;
}
