/**
 * LiveKit participant tile — matches VideoSDK ParticipantTile visuals.
 */
'use client';

import React, { useState } from 'react';
import {
  AudioTrack,
  VideoTrack,
  useIsMuted,
  useIsSpeaking,
  useParticipantTracks,
} from '@livekit/components-react';
import type { Participant } from 'livekit-client';
import { Track } from 'livekit-client';
import { profileImageUrlFromParticipantMeta } from './livekitParticipantMeta';

export interface LiveKitParticipantTileProps {
  participant: Participant;
  isLocal?: boolean;
  audioOnly?: boolean;
  audioVolume?: number;
  tileCount?: number;
  showNameLabel?: boolean;
}

const LiveKitParticipantTile = React.memo(function LiveKitParticipantTile({
  participant,
  isLocal = false,
  audioOnly = false,
  audioVolume = 0.85,
  tileCount = 1,
  showNameLabel = true,
}: LiveKitParticipantTileProps) {
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
  const micOn = Boolean(micTrackRef?.publication?.track) && !micMuted;
  const name = participant.name || participant.identity || 'Participant';
  const initial = name.trim().charAt(0).toUpperCase();
  const avatarFromMeta = profileImageUrlFromParticipantMeta(participant.metadata);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const isActiveSpeaker = useIsSpeaking(participant);

  if (audioOnly) {
    if (isLocal || !micTrackRef) return null;
    return (
      <AudioTrack
        trackRef={micTrackRef}
        volume={audioVolume}
      />
    );
  }

  const avatarSizeClass =
    tileCount <= 2
      ? 'w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 text-2xl sm:text-3xl'
      : tileCount <= 4
        ? 'w-14 h-14 sm:w-18 sm:h-18 md:w-20 md:h-20 text-xl sm:text-2xl'
        : tileCount <= 9
          ? 'w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 text-base sm:text-lg'
          : 'w-8 h-8 sm:w-10 sm:h-10 text-sm';

  return (
    <div
      className={`relative w-full h-full overflow-hidden transition-all duration-200 ${
        isActiveSpeaker && !isLocal ? 'ring-2 ring-inset ring-green-400' : ''
      }`}
      style={{ background: 'rgba(15, 23, 42, 0.58)' }}
    >
      {webcamOn && cameraTrackRef && (
        <VideoTrack
          trackRef={cameraTrackRef}
          className="absolute inset-0 h-full w-full min-h-0 min-w-0 object-cover"
          style={{
            transform: isLocal ? 'scaleX(-1)' : undefined,
          }}
        />
      )}

      {!webcamOn && (
        <div className="absolute inset-0 flex items-center justify-center">
          {avatarFromMeta && !avatarLoadFailed ? (
            <img
              src={avatarFromMeta}
              alt=""
              className={`rounded-full object-cover ${avatarSizeClass}`}
              onError={() => setAvatarLoadFailed(true)}
            />
          ) : (
            <div
              className={`rounded-full flex items-center justify-center ${avatarSizeClass}`}
              style={{
                background: isLocal
                  ? 'linear-gradient(135deg, #5b5fc7, #4f46e5)'
                  : 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
              }}
            >
              <span className="font-semibold text-white">{initial}</span>
            </div>
          )}
        </div>
      )}

      {!isLocal && micTrackRef && (
        <AudioTrack
          trackRef={micTrackRef}
          volume={audioVolume}
        />
      )}

      {showNameLabel && (
        <div className="absolute bottom-1 left-1 sm:bottom-2 sm:left-2 flex items-center gap-1 text-[10px] sm:text-xs text-white/90 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded max-w-[calc(100%-8px)]">
          {!micOn && (
            <svg
              className="w-2.5 h-2.5 flex-shrink-0 text-red-400"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z"
                clipRule="evenodd"
              />
            </svg>
          )}
          <span className="truncate">{isLocal ? 'You' : name}</span>
        </div>
      )}

      {isActiveSpeaker && !isLocal && (
        <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-lg" />
      )}
    </div>
  );
});

export default LiveKitParticipantTile;
