'use client';

import React from 'react';
import {
  AudioTrack,
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
  audioVolume = 0.85,
  mirrorLocal = true,
}: LiveKitParticipantMediaProps) {
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

  const webcamOn = Boolean(cameraTrackRef?.publication?.track) && !camMuted;

  if (audioOnly) {
    if (isLocal || !micTrackRef) return null;
    return <AudioTrack trackRef={micTrackRef} volume={audioVolume} />;
  }

  return (
    <>
      {webcamOn && cameraTrackRef && (
        <VideoTrack
          trackRef={cameraTrackRef}
          className="absolute inset-0 h-full w-full min-h-0 min-w-0 object-cover"
          style={{
            transform: isLocal && mirrorLocal ? 'scaleX(-1)' : undefined,
          }}
        />
      )}
      {!isLocal && micTrackRef && (
        <AudioTrack trackRef={micTrackRef} volume={audioVolume} />
      )}
    </>
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
