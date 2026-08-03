'use client';

import React, { useMemo } from 'react';
import type { Participant } from 'livekit-client';
import type { NormalizedParticipant } from '@/features/video/core/models';
import { profileImageUrlFromMeta } from '@/features/video/core/utils/participantMeta';
import LiveKitParticipantMedia, {
  useLiveKitParticipantState,
} from '../components/ParticipantMedia';
import ParticipantTile from '@/features/video/ui/ParticipantTile';

export function normalizeLiveKitParticipant(
  participant: Participant,
  isLocal = false,
  overrides?: Partial<
    Pick<NormalizedParticipant, 'isScreenSharing' | 'isActiveSpeaker' | 'isMicOn' | 'isCameraOn'>
  >,
): NormalizedParticipant {
  return {
    id: participant.identity,
    // Never fall back to `participant.identity` for display: it's the raw
    // Supabase user UUID, not something meaningful to show. The AccessToken
    // is now always minted with a real `name` (see issueLiveKitToken), so
    // this is a safety net for tokens issued before that, not the normal path.
    displayName: participant.name || 'Participant',
    isLocal,
    isMicOn: true,
    isCameraOn: true,
    isScreenSharing: false,
    isActiveSpeaker: false,
    avatarUrl: profileImageUrlFromMeta(participant.metadata),
    ...overrides,
  };
}

export interface LiveKitParticipantTileBridgeProps {
  participant: Participant;
  isLocal?: boolean;
  audioOnly?: boolean;
  audioVolume?: number;
  tileCount?: number;
  showNameLabel?: boolean;
}

export function LiveKitParticipantTileBridge({
  participant,
  isLocal = false,
  audioOnly = false,
  audioVolume = 0.85,
  tileCount = 1,
  showNameLabel = true,
}: LiveKitParticipantTileBridgeProps) {
  const liveState = useLiveKitParticipantState(participant);

  const normalized = useMemo(
    () =>
      normalizeLiveKitParticipant(participant, isLocal, {
        isMicOn: liveState.micOn,
        isCameraOn: liveState.webcamOn,
        isActiveSpeaker: liveState.isActiveSpeaker,
      }),
    [participant, isLocal, liveState],
  );

  const media = (
    <LiveKitParticipantMedia
      participant={participant}
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

export default LiveKitParticipantTileBridge;
