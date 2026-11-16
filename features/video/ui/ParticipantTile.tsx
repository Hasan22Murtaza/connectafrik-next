'use client';

import React from 'react';
import type { NormalizedParticipant } from '@/features/video/core/models';
import ParticipantInfo from './ParticipantInfo';
import { CALL_SPEAKING_RING, CALL_TILE_BG, CALL_TILE_BORDER } from './callTheme';

export interface ParticipantTileProps {
  participant: NormalizedParticipant;
  /** Provider-specific video/audio element(s) from adapter.renderParticipantMedia(). */
  media: React.ReactNode;
  audioOnly?: boolean;
  tileCount?: number;
  showNameLabel?: boolean;
  isHost?: boolean;
  onMute?: () => void;
}

/**
 * Unified participant tile — provider-agnostic shell.
 * Media rendering is delegated to the active provider via the `media` slot.
 */
const ParticipantTile = React.memo(function ParticipantTile({
  participant,
  media,
  audioOnly = false,
  tileCount = 1,
  showNameLabel = true,
  isHost = false,
  onMute,
}: ParticipantTileProps) {
  const { isActiveSpeaker, isMicOn, isLocal } = participant;
  const speaking = isActiveSpeaker && isMicOn;

  if (audioOnly) {
    if (isLocal) return null;
    return <>{media}</>;
  }

  return (
    <div
      className={`group relative h-full w-full overflow-hidden rounded-xl transition-[box-shadow,border-color] duration-300 sm:rounded-2xl ${
        speaking ? 'call-speaking-tile' : ''
      }`}
      style={{
        background: CALL_TILE_BG,
        border: speaking
          ? `2px solid ${CALL_SPEAKING_RING}`
          : `1px solid ${CALL_TILE_BORDER}`,
        boxShadow: speaking ? `0 0 0 1px ${CALL_SPEAKING_RING}, 0 0 24px rgba(74,222,128,0.18)` : undefined,
      }}
    >
      {media}
      <ParticipantInfo
        participant={participant}
        tileCount={tileCount}
        showNameLabel={showNameLabel}
        isHost={isHost}
        onMute={onMute}
      />
    </div>
  );
});

export default ParticipantTile;
