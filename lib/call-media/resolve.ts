import type { CallMediaProviderName } from './types';

export const DEFAULT_CALL_MEDIA_PROVIDER: CallMediaProviderName = 'livekit';

export function parseProviderName(
  value: string | undefined | null,
): CallMediaProviderName | null {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized === 'videosdk' || normalized === 'livekit') {
    return normalized;
  }
  return null;
}

export function isAutoProviderSelection(
  value: string | undefined | null,
): boolean {
  const normalized = (value ?? '').trim().toLowerCase();
  return !normalized || normalized === 'auto';
}

export function resolvePreferredProvider(
  raw?: string | null,
  fallback: CallMediaProviderName = DEFAULT_CALL_MEDIA_PROVIDER,
): CallMediaProviderName {
  if (isAutoProviderSelection(raw)) return fallback;
  return parseProviderName(raw) ?? fallback;
}

export function resolveFallbackProvider(
  preferred: CallMediaProviderName,
): CallMediaProviderName {
  return preferred === 'livekit' ? 'videosdk' : 'livekit';
}

/** Client-side auto pick — uses public env hints only (no secrets). */
export function resolveClientPreferredProvider(): CallMediaProviderName {
  const raw =
    process.env.NEXT_PUBLIC_CALL_MEDIA_PROVIDER ||
    process.env.NEXT_PUBLIC_VIDEO_PROVIDER;

  const explicit = parseProviderName(raw);
  if (explicit) return explicit;

  if (isAutoProviderSelection(raw)) {
    if (process.env.NEXT_PUBLIC_LIVEKIT_WS_URL?.trim()) return 'livekit';
    if (process.env.NEXT_PUBLIC_VIDEOSDK_API_KEY?.trim()) return 'videosdk';
    return DEFAULT_CALL_MEDIA_PROVIDER;
  }

  return DEFAULT_CALL_MEDIA_PROVIDER;
}
