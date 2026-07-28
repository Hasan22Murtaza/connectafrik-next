import type { CallMediaProviderName } from '@/lib/call-media/types';

export interface CallBootstrapPayload {
  token: string;
  provider?: CallMediaProviderName;
  wsUrl?: string;
}

const BOOTSTRAP_KEY_PREFIX = 'videosdk_call_bootstrap:';

export function readCallBootstrap(callId: string): CallBootstrapPayload | undefined {
  if (typeof window === 'undefined' || !callId.trim()) return undefined;
  try {
    const raw = sessionStorage.getItem(`${BOOTSTRAP_KEY_PREFIX}${callId.trim()}`);
    if (!raw) return undefined;
    sessionStorage.removeItem(`${BOOTSTRAP_KEY_PREFIX}${callId.trim()}`);
    const parsed = JSON.parse(raw) as CallBootstrapPayload;
    if (!parsed?.token || typeof parsed.token !== 'string') return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

export function writeCallBootstrap(callId: string, payload: CallBootstrapPayload): void {
  if (typeof window === 'undefined' || !callId.trim()) return;
  try {
    sessionStorage.setItem(
      `${BOOTSTRAP_KEY_PREFIX}${callId.trim()}`,
      JSON.stringify(payload),
    );
  } catch {
    /* ignore quota or private mode */
  }
}

export function parseCallMediaResponse(payload: Record<string, unknown>): {
  token?: string;
  provider: CallMediaProviderName;
  wsUrl?: string;
} {
  const token = typeof payload.token === 'string' ? payload.token : undefined;
  const provider =
    payload.provider === 'videosdk' || payload.provider === 'livekit'
      ? payload.provider
      : 'videosdk';
  const wsUrl = typeof payload.wsUrl === 'string' ? payload.wsUrl : undefined;
  return { token, provider, wsUrl };
}

export function resolveLiveKitWsUrl(explicit?: string): string | undefined {
  if (explicit?.trim()) return explicit.trim();
  const fromEnv = process.env.NEXT_PUBLIC_LIVEKIT_WS_URL?.trim();
  return fromEnv || undefined;
}
