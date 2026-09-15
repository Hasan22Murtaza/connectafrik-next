'use client';

import { useEffect, useRef } from 'react';
import { useMeeting, usePubSub } from '@videosdk.live/react-sdk';
import {
  CALL_ENGAGEMENT_TOPIC,
  decodeCallEngagement,
  type CallEngagementPayload,
} from '@/features/video/core/callEngagement';
import {
  useCallEngagementController,
  type CallEngagementApi,
} from '@/features/video/hooks/useCallEngagementController';

export function useVideoSDKCallEngagement(
  selfId: string,
  selfName: string,
  activeIds: string[],
): CallEngagementApi {
  const { api, attachPublish, applyIncoming } = useCallEngagementController(
    selfId,
    selfName,
    activeIds,
  );
  const applyRef = useRef(applyIncoming);
  applyRef.current = applyIncoming;
  const attachRef = useRef(attachPublish);
  attachRef.current = attachPublish;

  const { publish } = usePubSub(CALL_ENGAGEMENT_TOPIC, {
    onMessageReceived: (message: { message?: string; senderId?: string }) => {
      const parsed = decodeCallEngagement(String(message?.message || ''));
      if (parsed) applyRef.current(parsed, message?.senderId);
    },
  });

  useEffect(() => {
    attachRef.current((payload) => {
      try {
        void publish(JSON.stringify(payload), { persist: false });
      } catch {
        /* meeting may not be joined yet */
      }
    });
  }, [publish]);

  const { participants } = useMeeting();
  const remoteCount = participants?.size ?? 0;
  const prevRemote = useRef(0);

  useEffect(() => {
    if (remoteCount > prevRemote.current) {
      try {
        void publish(JSON.stringify({ v: 1, t: 'hand-req' } satisfies CallEngagementPayload), {
          persist: false,
        });
      } catch {
        /* ignore */
      }
    }
    prevRemote.current = remoteCount;
  }, [publish, remoteCount]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        void publish(JSON.stringify({ v: 1, t: 'hand-req' } satisfies CallEngagementPayload), {
          persist: false,
        });
      } catch {
        /* ignore */
      }
    }, 900);
    return () => window.clearTimeout(t);
  }, [publish, selfId]);

  return api;
}
