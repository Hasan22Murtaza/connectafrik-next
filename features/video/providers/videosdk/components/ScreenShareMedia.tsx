'use client';

import React from 'react';
import { VideoPlayer } from '@videosdk.live/react-sdk';
import type { ScreenShareMediaOptions } from '@/features/video/core/interfaces/CallMediaProvider';

export interface VideoSDKScreenShareMediaProps extends ScreenShareMediaOptions {
  presenterId: string;
}

export function VideoSDKScreenShareMedia({
  presenterId,
  objectFit = 'contain',
}: VideoSDKScreenShareMediaProps) {
  return (
    <VideoPlayer
      participantId={presenterId}
      type="share"
      className="w-full h-full"
      videoStyle={{ objectFit, background: '#111827' }}
    />
  );
}

export default VideoSDKScreenShareMedia;
