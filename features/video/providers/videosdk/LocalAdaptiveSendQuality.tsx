'use client';

import { useParticipant } from '@videosdk.live/react-sdk';
import { useEffect, useRef } from 'react';
import {
  inferSendQualityFromNetwork,
  type SendQuality,
} from '@/features/video/services/adaptiveCallQuality';

/**
 * Adjusts local outgoing video quality (low / med / high) from Network Information.
 * Mount only when `participantId` is the local user and video is active.
 */
export function LocalAdaptiveSendQuality({
  participantId,
  active,
}: {
  participantId: string;
  active: boolean;
}) {
  const { setQuality, setScreenShareQuality } = useParticipant(participantId);
  const lastTierRef = useRef<SendQuality | null>(null);

  useEffect(() => {
    if (!active || !participantId) return;

    const apply = () => {
      const tier = inferSendQualityFromNetwork();
      if (lastTierRef.current === tier) return;
      lastTierRef.current = tier;
      try {
        setQuality(tier);
      } catch {
        /* ignore SDK edge cases during teardown */
      }
      try {
        setScreenShareQuality(tier);
      } catch {
        /* no-op when not sharing */
      }
    };

    apply();

    const conn =
      typeof navigator !== 'undefined'
        ? (navigator as Navigator & { connection?: { addEventListener?: (t: string, fn: () => void) => void; removeEventListener?: (t: string, fn: () => void) => void } }).connection
        : undefined;
    const onChange = () => {
      lastTierRef.current = null;
      apply();
    };
    conn?.addEventListener?.('change', onChange);

    const intervalId = window.setInterval(apply, 45_000);

    return () => {
      conn?.removeEventListener?.('change', onChange);
      window.clearInterval(intervalId);
    };
  }, [active, participantId, setQuality, setScreenShareQuality]);

  return null;
}
