'use client';

import React from 'react';
import { VideoTrack } from '@livekit/components-react';
import type { Participant } from 'livekit-client';
import { Track } from 'livekit-client';
import type { ScreenShareMediaOptions } from '@/features/video/core/interfaces/CallMediaProvider';

export interface LiveKitScreenShareMediaProps extends ScreenShareMediaOptions {
  presenter: Participant;
}

export function LiveKitScreenShareMedia({
  presenter,
  objectFit = 'contain',
}: LiveKitScreenShareMediaProps) {
  const screenPub = presenter.getTrackPublication(Track.Source.ScreenShare);

  if (!screenPub?.track) {
    return <div className="text-white/60 text-sm">Waiting for screen share…</div>;
  }

  return (
    <VideoTrack
      trackRef={{
        participant: presenter,
        publication: screenPub,
        source: Track.Source.ScreenShare,
      }}
      className="w-full h-full"
      style={{ objectFit, background: '#111827' }}
    />
  );
}

export default LiveKitScreenShareMedia;
