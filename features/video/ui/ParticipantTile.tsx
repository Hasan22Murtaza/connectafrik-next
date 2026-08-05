'use client';

import React from 'react';
import type { NormalizedParticipant } from '@/features/video/core/models';
import ParticipantInfo from './ParticipantInfo';

export interface ParticipantTileProps {
  participant: NormalizedParticipant;
  /** Provider-specific video/audio element(s) from adapter.renderParticipantMedia(). */
  media: React.ReactNode;
  audioOnly?: boolean;
  tileCount?: number;
  showNameLabel?: boolean;
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
}: ParticipantTileProps) {
  const { isLocal, isActiveSpeaker } = participant;

  if (audioOnly) {
    if (isLocal) return null;
    return <>{media}</>;
  }

  return (
    <div
      className={`relative w-full h-full overflow-hidden transition-all duration-200 ${
        isActiveSpeaker && !isLocal ? 'ring-2 ring-inset ring-green-400' : ''
      }`}
      style={{ background: 'rgba(15, 23, 42, 0.58)' }}
    >
      {media}
      <ParticipantInfo
        participant={participant}
        tileCount={tileCount}
        showNameLabel={showNameLabel}
      />
    </div>
  );
});

export default ParticipantTile;
