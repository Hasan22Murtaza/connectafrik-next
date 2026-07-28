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
}

export interface IssueCallTokenOptions {
  roomId: string;
  userId: string;
  displayName?: string;
}
