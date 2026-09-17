'use client';

import React, { useMemo } from 'react';
import { MicOff } from '@/shared/icons';
import type { Participant } from 'livekit-client';
import type { NormalizedParticipant } from '@/features/video/core/models';
import { profileImageUrlFromMeta } from '@/features/video/core/utils/participantMeta';
import { mapLiveKitConnectionQuality } from '@/features/video/core/utils/connectionQuality';
import LiveKitParticipantMedia, {
  useLiveKitParticipantState,
} from '../components/ParticipantMedia';
import ParticipantTile from '@/features/video/ui/ParticipantTile';
import NetworkQualityIndicator from '@/features/video/ui/NetworkQualityIndicator';

export function normalizeLiveKitParticipant(
  participant: Participant,
  isLocal = false,
  overrides?: Partial<
    Pick<
      NormalizedParticipant,
      | 'isScreenSharing'
      | 'isActiveSpeaker'
      | 'isMicOn'
      | 'isCameraOn'
      | 'handRaised'
      | 'connectionQuality'
    >
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
    connectionQuality: mapLiveKitConnectionQuality(participant.connectionQuality),
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
  handRaised?: boolean;
  onMute?: () => void;
}

export function LiveKitParticipantTileBridge({
  participant,
  isLocal = false,
  audioOnly = false,
  audioVolume = 0.85,
  tileCount = 1,
  showNameLabel = true,
  handRaised = false,
  onMute,
}: LiveKitParticipantTileBridgeProps) {
  const liveState = useLiveKitParticipantState(participant);

  const normalized = useMemo(
    () =>
      normalizeLiveKitParticipant(participant, isLocal, {
        isMicOn: liveState.micOn,
        isCameraOn: liveState.webcamOn,
        isActiveSpeaker: liveState.isActiveSpeaker,
        handRaised,
        connectionQuality: liveState.connectionQuality,
      }),
    [participant, isLocal, liveState, handRaised],
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
      onMute={onMute}
    />
  );
}

/** Mute + network chrome for audio-only 1:1 (no video tile). */
export function LiveKitParticipantStatusChrome({
  participant,
}: {
  participant: Participant;
}) {
  const liveState = useLiveKitParticipantState(participant);
  if (liveState.micOn) {
    return null;
  }

  return (
    <div className="mt-3 flex items-center justify-center gap-2">
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-medium text-white shadow-md">
        <MicOff className="h-3 w-3" aria-hidden />
        Muted
      </span>
    </div>
  );
}

export function LiveKitLocalNetworkChip({
  participant,
}: {
  participant: Participant;
}) {
  const { connectionQuality } = useLiveKitParticipantState(participant);
  return <NetworkQualityIndicator quality={connectionQuality} size="md" showLabel />;
}

export default LiveKitParticipantTileBridge;
