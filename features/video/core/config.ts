import {
  DEFAULT_CALL_MEDIA_PROVIDER,
  parseProviderName,
  resolveClientPreferredProvider,
  resolveFallbackProvider,
} from '@/lib/call-media/resolve';
import type { CallMediaProviderName } from '@/lib/call-media/types';

/**
 * Client-side provider preference.
 *
 * Set `NEXT_PUBLIC_CALL_MEDIA_PROVIDER=auto` (or leave unset) to auto-pick LiveKit first,
 * then VideoSDK. Server uses the same order in `lib/call-media/provider.ts`.
 */
export function resolveClientVideoProvider(): CallMediaProviderName {
  return resolveClientPreferredProvider();
}

export function resolveClientFallbackVideoProvider(): CallMediaProviderName {
  return resolveFallbackProvider(resolveClientVideoProvider());
}

export function isValidProviderName(
  value: string | undefined | null,
): value is CallMediaProviderName {
  return parseProviderName(value) !== null;
}

export { DEFAULT_CALL_MEDIA_PROVIDER, resolveFallbackProvider };
