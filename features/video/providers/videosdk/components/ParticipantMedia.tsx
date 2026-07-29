'use client';

import React, { useEffect, useRef } from 'react';
import { useParticipant, VideoPlayer } from '@videosdk.live/react-sdk';
import type { ParticipantMediaOptions } from '@/features/video/core/interfaces/CallMediaProvider';

export interface VideoSDKParticipantMediaProps extends ParticipantMediaOptions {
  participantId: string;
}

/** VideoSDK-specific media renderer — only used inside the VideoSDK provider bridge. */
export function VideoSDKParticipantMedia({
  participantId,
  isLocal = false,
  audioOnly = false,
  audioVolume = 0.85,
  mirrorLocal = true,
}: VideoSDKParticipantMediaProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const { micStream, webcamOn, micOn } = useParticipant(participantId);

  useEffect(() => {
    if (isLocal) return;
    const el = audioRef.current;
    if (!el) return;
    if (micOn && micStream?.track) {
      const ms = new MediaStream([micStream.track]);
      el.srcObject = ms;
      el.volume = Math.min(1, Math.max(0, audioVolume));
      el.muted = false;
      el.play().catch(() => {});
    } else {
      el.srcObject = null;
    }
    return () => {
      if (el) el.srcObject = null;
    };
  }, [micStream, micOn, isLocal, audioVolume]);

  useEffect(() => {
    if (!isLocal && audioRef.current) {
      audioRef.current.volume = Math.min(1, Math.max(0, audioVolume));
    }
  }, [audioVolume, isLocal]);

  if (audioOnly) {
    if (isLocal) return null;
    return <audio ref={audioRef} autoPlay playsInline className="hidden" />;
  }

  return (
    <>
      {webcamOn && (
        <VideoPlayer
          participantId={participantId}
          type="video"
          className="absolute inset-0 h-full w-full min-h-0 min-w-0"
          containerStyle={{
            width: '100%',
            height: '100%',
            minHeight: 0,
            minWidth: 0,
            overflow: 'hidden',
          }}
          videoStyle={{
            display: 'block',
            objectFit: 'cover',
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            minWidth: '100%',
            minHeight: '100%',
            transform: isLocal && mirrorLocal ? 'scaleX(-1) translateZ(0)' : 'translateZ(0)',
            willChange: 'transform',
            backfaceVisibility: 'hidden',
          }}
        />
      )}
      {!isLocal && <audio ref={audioRef} autoPlay playsInline className="hidden" />}
    </>
  );
}

export default VideoSDKParticipantMedia;
