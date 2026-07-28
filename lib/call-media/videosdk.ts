import jwt from 'jsonwebtoken';
import { generateVideosdkParticipantJwt } from '@/lib/videosdk-participant-jwt';
import type { CallMediaCredentials, CreateCallRoomOptions, IssueCallTokenOptions } from './types';

const TOKEN_TTL = '10m';

function getVideosdkApiCredentials(): { apiKey: string; apiSecret: string } {
  const apiKey = process.env.VIDEOSDK_API_KEY?.trim();
  const apiSecret =
    process.env.VIDEOSDK_SECRET_KEY?.trim() ??
    process.env.VIDEOSDK_SECRET?.trim() ??
    process.env.VITE_VIDEOSDK_SECRET_KEY?.trim() ??
    process.env.NEXT_PUBLIC_VIDEOSDK_SECRET_KEY?.trim();
  if (!apiKey || !apiSecret) {
    throw new Error('VideoSDK API credentials not configured');
  }
  return { apiKey, apiSecret };
}

export function isVideosdkConfigured(): boolean {
  try {
    getVideosdkApiCredentials();
    return true;
  } catch {
    return false;
  }
}

async function createVideosdkRemoteRoom(): Promise<string> {
  const { apiKey, apiSecret } = getVideosdkApiCredentials();

  const apiAuthToken = jwt.sign(
    {
      apikey: apiKey,
      permissions: ['allow_join', 'allow_mod'],
      version: 2,
    },
    apiSecret,
    {
      algorithm: 'HS256',
      expiresIn: '24h',
    },
  );

  const response = await fetch('https://api.videosdk.live/v2/rooms', {
    method: 'POST',
    headers: {
      Authorization: apiAuthToken,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorData: { message?: string; error?: string };
    try {
      errorData = JSON.parse(errorText) as { message?: string; error?: string };
    } catch {
      errorData = { message: errorText || `HTTP ${response.status}` };
    }
    throw new Error(errorData.message || errorData.error || 'Failed to create VideoSDK room');
  }

  const data = (await response.json()) as { roomId?: string };
  if (!data.roomId) {
    throw new Error('VideoSDK room ID not found in response');
  }
  return data.roomId;
}

export async function issueVideosdkToken(
  options: IssueCallTokenOptions,
): Promise<string> {
  return generateVideosdkParticipantJwt(options.roomId, options.userId);
}

export async function createVideosdkCallRoom(
  options: CreateCallRoomOptions,
): Promise<CallMediaCredentials> {
  const roomId = await createVideosdkRemoteRoom();

  const credentials: CallMediaCredentials = {
    roomId,
    token: '',
    provider: 'videosdk',
    userId: options.userId,
    expiresIn: TOKEN_TTL,
  };

  if (options.includeParticipantToken) {
    credentials.token = await issueVideosdkToken({
      roomId,
      userId: options.userId,
    });
  }

  return credentials;
}
