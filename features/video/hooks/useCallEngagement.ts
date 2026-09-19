'use client';

import { useEffect, useRef } from 'react';
import { RoomEvent } from 'livekit-client';
import { useRoomContext } from '@livekit/components-react';
import {
  CALL_ENGAGEMENT_TOPIC,
  decodeCallEngagement,
  type CallEngagementPayload,
} from '@/features/video/core/callEngagement';
import {
  useCallEngagementController,
  type CallEngagementApi,
} from '@/features/video/hooks/useCallEngagementController';

export type { CallEngagementApi };

export function useLiveKitCallEngagement(
  selfId: string,
  selfName: string,
  activeIds: string[],
): CallEngagementApi {
  const room = useRoomContext();
  const { api, attachPublish, applyIncoming } = useCallEngagementController(
    selfId,
    selfName,
    activeIds,
  );
  const applyRef = useRef(applyIncoming);
  applyRef.current = applyIncoming;
  const attachRef = useRef(attachPublish);
  attachRef.current = attachPublish;

  useEffect(() => {
    const send = (payload: CallEngagementPayload) => {
      if (room.state !== 'connected') return;
      const bytes = new TextEncoder().encode(JSON.stringify(payload));
      void room.localParticipant.publishData(bytes, {
        reliable: true,
        topic: CALL_ENGAGEMENT_TOPIC,
      });
    };
    attachRef.current(send);

    const onData = (
      payload: Uint8Array,
      participant?: { identity?: string },
      _kind?: unknown,
      topic?: string,
    ) => {
      if (topic && topic !== CALL_ENGAGEMENT_TOPIC) return;
      const parsed = decodeCallEngagement(new TextDecoder().decode(payload));
      if (parsed) applyRef.current(parsed, participant?.identity);
    };
    const requestSync = () => send({ v: 1, t: 'hand-req' });

    room.on(RoomEvent.DataReceived, onData);
    room.on(RoomEvent.Connected, requestSync);
    room.on(RoomEvent.ParticipantConnected, requestSync);
    if (room.state === 'connected') requestSync();

    return () => {
      room.off(RoomEvent.DataReceived, onData);
      room.off(RoomEvent.Connected, requestSync);
      room.off(RoomEvent.ParticipantConnected, requestSync);
    };
  }, [room]);

  return api;
}
