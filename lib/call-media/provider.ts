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
    expiresIn: provider === 'livekit' ? '6h' : '10m',
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
 *
 * If `options.provider` is set (the provider the room was actually created
 * on, per `call_sessions.metadata.provider`), it is preferred over re-resolving
 * from env. Without this, every token request -- accept, rejoin, a late
 * group-call joiner -- re-derives "preferred" independently, and a transient
 * failover at room-creation time can silently diverge from what a later
 * request resolves to: a participant who connects successfully but to a fresh,
 * empty room on the OTHER provider, indistinguishable from an ordinary
 * missed/no-media bug.
 */
export async function issueCallToken(
  options: IssueCallTokenOptions,
): Promise<CallMediaCredentials> {
  const preferred = options.provider ?? resolvePreferredProvider();
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
