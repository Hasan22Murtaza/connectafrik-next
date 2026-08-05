'use client';

import React, { useEffect, useRef } from 'react';
import { useParticipant } from '@videosdk.live/react-sdk';

/**
 * Mounts one hidden <audio> element per REMOTE participant, independently of
 * the visual layout.
 *
 * Previously this audio element lived inside VideoSDKParticipantMedia, a
 * child of the participant's visual tile. Pagination caps the grid at 8
 * tiles, and screen share replaces the whole grid, so any participant not on
 * the visible page/tile had their tile -- and with it their audio -- torn
 * down while still connected and talking. Audio must never be a child of a
 * component whose mounting is driven by layout; mount every remote
 * participant's audio once, here, unconditionally.
 */
function clampVolume(v: number): number {
  return Math.min(1, Math.max(0, v));
}

const RemoteAudio = React.memo(function RemoteAudio({
  participantId,
  volume,
}: {
  participantId: string;
  volume: number;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  const { micStream, micOn } = useParticipant(participantId);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (micOn && micStream?.track) {
      el.srcObject = new MediaStream([micStream.track]);
      el.volume = clampVolume(volume);
      el.muted = false;
      el.play().catch(() => {});
    } else {
      el.srcObject = null;
    }
    return () => {
      if (el) el.srcObject = null;
    };
  }, [micStream, micOn, volume]);

  useEffect(() => {
    if (ref.current) ref.current.volume = clampVolume(volume);
  }, [volume]);

  return <audio ref={ref} autoPlay playsInline className="hidden" />;
});

export function RemoteAudioSink({
  participantIds,
  volume,
}: {
  participantIds: string[];
  volume: number;
}) {
  return (
    <>
      {participantIds.map((id) => (
        <RemoteAudio key={id} participantId={id} volume={volume} />
      ))}
    </>
  );
}

export default RemoteAudioSink;
