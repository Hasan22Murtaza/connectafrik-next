import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import type { CallMediaCredentials, CreateCallRoomOptions, IssueCallTokenOptions } from './types';
import { generateCallRoomId } from './room-id';

const TOKEN_TTL = '10m';

function getLiveKitApiCredentials(): { apiKey: string; apiSecret: string } {
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!apiKey || !apiSecret) {
    throw new Error('LiveKit API credentials not configured');
  }
  return { apiKey, apiSecret };
}

export function getLiveKitWsUrl(): string {
  const wsUrl =
    process.env.LIVEKIT_WS_URL?.trim() ||
    process.env.NEXT_PUBLIC_LIVEKIT_WS_URL?.trim() ||
    '';
  if (!wsUrl) {
    throw new Error('LiveKit WebSocket URL not configured');
  }
  return wsUrl;
}

function getLiveKitHttpUrl(): string {
  const explicit = process.env.LIVEKIT_URL?.trim();
  if (explicit) return explicit;

  const wsUrl = getLiveKitWsUrl();
  if (wsUrl.startsWith('wss://')) return `https://${wsUrl.slice(6)}`;
  if (wsUrl.startsWith('ws://')) return `http://${wsUrl.slice(5)}`;
  throw new Error('Could not derive LiveKit HTTP URL from WebSocket URL');
}

function getRoomServiceClient(): RoomServiceClient {
  const { apiKey, apiSecret } = getLiveKitApiCredentials();
  return new RoomServiceClient(getLiveKitHttpUrl(), apiKey, apiSecret);
}

export function isLiveKitConfigured(): boolean {
  try {
    getLiveKitApiCredentials();
    getLiveKitWsUrl();
    return true;
  } catch {
    return false;
  }
}

async function ensureLiveKitRoom(roomId: string): Promise<void> {
  const client = getRoomServiceClient();
  try {
    await client.createRoom({
      name: roomId,
      emptyTimeout: 300,
      departureTimeout: 20,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    // Room may already exist when rejoining or after a retry.
    if (!/already exists/i.test(message)) {
      throw error;
    }
  }
}

export async function issueLiveKitToken(
  options: IssueCallTokenOptions,
): Promise<string> {
  const { apiKey, apiSecret } = getLiveKitApiCredentials();
  const { roomId, userId, displayName, avatarUrl } = options;

  await ensureLiveKitRoom(roomId);

  const trimmedAvatar = avatarUrl?.trim();

  const at = new AccessToken(apiKey, apiSecret, {
    identity: userId,
    name: displayName?.trim() || userId,
    ttl: TOKEN_TTL,
    // Read by profileImageUrlFromMeta() on every other participant's tile.
    // Without this, a LiveKit participant's `name`/`metadata` are only ever
    // set once at token-mint time, so a missing displayName/avatarUrl here
    // falls back to the raw participant identity (the user's UUID) and no
    // photo, which is exactly what was rendering on the call grid tiles.
    ...(trimmedAvatar ? { metadata: JSON.stringify({ profileImage: trimmedAvatar }) } : {}),
  });
  at.addGrant({
    roomJoin: true,
    room: roomId,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return at.toJwt();
}

export async function createLiveKitCallRoom(
  options: CreateCallRoomOptions,
): Promise<CallMediaCredentials> {
  const roomId = generateCallRoomId();
  await ensureLiveKitRoom(roomId);

  const credentials: CallMediaCredentials = {
    roomId,
    token: '',
    provider: 'livekit',
    wsUrl: getLiveKitWsUrl(),
    userId: options.userId,
    expiresIn: TOKEN_TTL,
  };

  if (options.includeParticipantToken) {
    credentials.token = await issueLiveKitToken({
      roomId,
      userId: options.userId,
      displayName: options.displayName,
      avatarUrl: options.avatarUrl,
    });
  }

  return credentials;
}
