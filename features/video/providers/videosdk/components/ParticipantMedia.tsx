'use client';

import React from 'react';
import { useParticipant, VideoPlayer } from '@videosdk.live/react-sdk';
import type { ParticipantMediaOptions } from '@/features/video/core/interfaces/CallMediaProvider';

export interface VideoSDKParticipantMediaProps extends ParticipantMediaOptions {
  participantId: string;
}

/**
 * VideoSDK-specific media renderer — only used inside the VideoSDK provider bridge.
 *
 * Audio is intentionally NOT rendered here. `<RemoteAudioSink>` (mounted once
 * in MeetingContainer, outside any layout branch) plays every remote
 * participant's audio regardless of whether their tile is on screen.
 * Rendering it again per-tile would double the audio and would reintroduce
 * the original bug on top of that: a tile-scoped <audio> still goes silent
 * whenever pagination/screen-share/status-gating unmounts the tile.
 */
export function VideoSDKParticipantMedia({
  participantId,
  isLocal = false,
  audioOnly = false,
  mirrorLocal = true,
}: VideoSDKParticipantMediaProps) {
  const { webcamOn } = useParticipant(participantId);

  if (audioOnly) return null;
  if (!webcamOn) return null;

  return (
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
  );
}

export default VideoSDKParticipantMedia;
