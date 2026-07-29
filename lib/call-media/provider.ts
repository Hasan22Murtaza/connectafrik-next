import {
  createLiveKitCallRoom,
  isLiveKitConfigured,
  issueLiveKitToken,
} from './livekit';
import {
  createVideosdkCallRoom,
  isVideosdkConfigured,
  issueVideosdkToken,
} from './videosdk';
import {
  DEFAULT_CALL_MEDIA_PROVIDER,
  isAutoProviderSelection,
  parseProviderName,
  resolveFallbackProvider,
} from './resolve';
import type {
  CallMediaCredentials,
  CallMediaProviderName,
  CreateCallRoomOptions,
  IssueCallTokenOptions,
} from './types';

export function resolvePreferredProvider(): CallMediaProviderName {
  const raw = process.env.CALL_MEDIA_PROVIDER;
  const explicit = parseProviderName(raw);
  if (explicit) return explicit;

  if (isAutoProviderSelection(raw)) {
    if (isLiveKitConfigured()) return 'livekit';
    if (isVideosdkConfigured()) return 'videosdk';
    return DEFAULT_CALL_MEDIA_PROVIDER;
  }

  return DEFAULT_CALL_MEDIA_PROVIDER;
}

async function createWithProvider(
  provider: CallMediaProviderName,
  options: CreateCallRoomOptions,
): Promise<CallMediaCredentials> {
  if (provider === 'livekit') {
    return createLiveKitCallRoom(options);
  }
  return createVideosdkCallRoom(options);
}

async function issueWithProvider(
  provider: CallMediaProviderName,
  options: IssueCallTokenOptions,
): Promise<CallMediaCredentials> {
  const token =
    provider === 'livekit'
      ? await issueLiveKitToken(options)
      : await issueVideosdkToken(options);

  return {
    roomId: options.roomId,
    token,
    provider,
    userId: options.userId,
    expiresIn: '10m',
    ...(provider === 'livekit'
      ? {
          wsUrl:
            process.env.LIVEKIT_WS_URL?.trim() ||
            process.env.NEXT_PUBLIC_LIVEKIT_WS_URL?.trim(),
        }
      : {}),
  };
}

/**
 * Create a call room using the preferred provider, auto-failing over to the other
 * provider when the preferred one is misconfigured or throws.
 */
export async function createCallRoom(
  options: CreateCallRoomOptions,
): Promise<CallMediaCredentials> {
  const preferred = resolvePreferredProvider();
  const fallback = resolveFallbackProvider(preferred);

  const preferredReady =
    preferred === 'livekit' ? isLiveKitConfigured() : isVideosdkConfigured();
  const fallbackReady =
    fallback === 'livekit' ? isLiveKitConfigured() : isVideosdkConfigured();

  if (!preferredReady && !fallbackReady) {
    throw new Error('No call media provider is configured');
  }

  if (!preferredReady) {
    return createWithProvider(fallback, options);
  }

  try {
    return await createWithProvider(preferred, options);
  } catch (error) {
    if (!fallbackReady) throw error;
    console.warn(
      `[call-media] ${preferred} room creation failed; falling back to ${fallback}`,
      error,
    );
    return createWithProvider(fallback, options);
  }
}

/**
 * Issue a participant token for an existing room, with the same failover rules.
 */
export async function issueCallToken(
  options: IssueCallTokenOptions,
): Promise<CallMediaCredentials> {
  const preferred = resolvePreferredProvider();
  const fallback = resolveFallbackProvider(preferred);

  const preferredReady =
    preferred === 'livekit' ? isLiveKitConfigured() : isVideosdkConfigured();
  const fallbackReady =
    fallback === 'livekit' ? isLiveKitConfigured() : isVideosdkConfigured();

  if (!preferredReady && !fallbackReady) {
    throw new Error('No call media provider is configured');
  }

  if (!preferredReady) {
    return issueWithProvider(fallback, options);
  }

  try {
    return await issueWithProvider(preferred, options);
  } catch (error) {
    if (!fallbackReady) throw error;
    console.warn(
      `[call-media] ${preferred} token issue failed; falling back to ${fallback}`,
      error,
    );
    return issueWithProvider(fallback, options);
  }
}
