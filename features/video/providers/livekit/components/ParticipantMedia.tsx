'use client';

import React from 'react';
import {
  VideoTrack,
  useIsMuted,
  useIsSpeaking,
  useParticipantTracks,
} from '@livekit/components-react';
import type { Participant } from 'livekit-client';
import { Track } from 'livekit-client';
import type { ParticipantMediaOptions } from '@/features/video/core/interfaces/CallMediaProvider';

export interface LiveKitParticipantMediaProps extends ParticipantMediaOptions {
  participant: Participant;
}

export function LiveKitParticipantMedia({
  participant,
  isLocal = false,
  audioOnly = false,
  mirrorLocal = true,
}: LiveKitParticipantMediaProps) {
  const cameraTracks = useParticipantTracks([Track.Source.Camera], participant.identity);
  const cameraTrackRef = cameraTracks[0];

  const camMuted = useIsMuted(
    cameraTrackRef ?? { participant, source: Track.Source.Camera },
  );

  const webcamOn = Boolean(cameraTrackRef?.publication?.track) && !camMuted;

  // Audio is intentionally NOT rendered here. `<RoomAudioRenderer />` (mounted
  // once in LiveKitMeetingContainer, outside any layout branch) plays every
  // remote participant's audio regardless of whether their tile is on screen.
  // Rendering it again per-tile would double the audio and would reintroduce
  // the original bug on top of that: a tile-scoped <AudioTrack> still goes
  // silent whenever pagination/screen-share/status-gating unmounts the tile.
  if (audioOnly) return null;

  if (!webcamOn || !cameraTrackRef) return null;

  return (
    <VideoTrack
      trackRef={cameraTrackRef}
      className="absolute inset-0 h-full w-full min-h-0 min-w-0 object-cover"
      style={{
        transform: isLocal && mirrorLocal ? 'scaleX(-1)' : undefined,
      }}
    />
  );
}

/** Hook helper for normalized participant state from LiveKit. */
export function useLiveKitParticipantState(participant: Participant) {
  const cameraTracks = useParticipantTracks([Track.Source.Camera], participant.identity);
  const micTracks = useParticipantTracks([Track.Source.Microphone], participant.identity);
  const cameraTrackRef = cameraTracks[0];
  const micTrackRef = micTracks[0];
  const camMuted = useIsMuted(
    cameraTrackRef ?? { participant, source: Track.Source.Camera },
  );
  const micMuted = useIsMuted(
    micTrackRef ?? { participant, source: Track.Source.Microphone },
  );
  const isSpeaking = useIsSpeaking(participant);

  return {
    webcamOn: Boolean(cameraTrackRef?.publication?.track) && !camMuted,
    micOn: Boolean(micTrackRef?.publication?.track) && !micMuted,
    isActiveSpeaker: isSpeaking,
  };
}

export default LiveKitParticipantMedia;
