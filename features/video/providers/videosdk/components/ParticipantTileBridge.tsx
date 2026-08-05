'use client';

import React, { useMemo } from 'react';
import { useParticipant } from '@videosdk.live/react-sdk';
import type { NormalizedParticipant } from '@/features/video/core/models';
import { profileImageUrlFromMeta } from '@/features/video/core/utils/participantMeta';
import VideoSDKParticipantMedia from '../components/ParticipantMedia';
import ParticipantTile from '@/features/video/ui/ParticipantTile';

export function useVideoSDKNormalizedParticipant(
  participantId: string,
  isLocal = false,
): NormalizedParticipant {
  const { micOn, webcamOn, displayName, isActiveSpeaker, participant } =
    useParticipant(participantId);

  return useMemo(
    () => ({
      id: participantId,
      displayName: displayName || 'Participant',
      isLocal,
      isMicOn: micOn,
      isCameraOn: webcamOn,
      isScreenSharing: false,
      isActiveSpeaker,
      avatarUrl: profileImageUrlFromMeta(participant?.metaData),
    }),
    [participantId, isLocal, micOn, webcamOn, displayName, isActiveSpeaker, participant?.metaData],
  );
}

export interface VideoSDKParticipantTileBridgeProps {
  participantId: string;
  isLocal?: boolean;
  audioOnly?: boolean;
  audioVolume?: number;
  tileCount?: number;
  showNameLabel?: boolean;
}

/** Bridges VideoSDK SDK state into the unified ParticipantTile. */
export function VideoSDKParticipantTileBridge({
  participantId,
  isLocal = false,
  audioOnly = false,
  audioVolume = 0.85,
  tileCount = 1,
  showNameLabel = true,
}: VideoSDKParticipantTileBridgeProps) {
  const normalized = useVideoSDKNormalizedParticipant(participantId, isLocal);

  const media = (
    <VideoSDKParticipantMedia
      participantId={participantId}
      isLocal={isLocal}
      audioOnly={audioOnly}
      audioVolume={audioVolume}
    />
  );

  return (
    <ParticipantTile
      participant={normalized}
      media={media}
      audioOnly={audioOnly}
      tileCount={tileCount}
      showNameLabel={showNameLabel}
    />
  );
}

export default VideoSDKParticipantTileBridge;
