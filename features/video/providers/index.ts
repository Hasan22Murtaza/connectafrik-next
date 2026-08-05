/**
 * Provider registry — runtime selection for call media backends.
 */
import type { CallMediaProviderName } from '@/lib/call-media/types';
import { resolveClientVideoProvider } from '../core/config';

export { resolveClientVideoProvider } from '../core/config';

export type { CallMediaProviderName };

export function resolveActiveProvider(
  hint?: CallMediaProviderName | null,
): CallMediaProviderName {
  if (hint === 'livekit' || hint === 'videosdk') return hint;
  return resolveClientVideoProvider();
}
