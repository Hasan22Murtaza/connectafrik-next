/**
 * ParticipantTile — react-sdk participant renderer.
 *
 * Uses the SDK's built-in `VideoPlayer` for webcam rendering (handles stream
 * attachment, cleanup, and adaptive observers automatically) and `useParticipant`
 * for reactive state. A manual <audio> element is kept for mic playback so we
 * can control speaker volume without a wrapper component.
 */
import React, { useEffect, useRef } from 'react';
import { useParticipant, VideoPlayer } from '@videosdk.live/react-sdk';

export interface ParticipantTileProps {
  participantId: string;
  isLocal?: boolean;
  /**
   * Remote audio only (no webcam/avatar tile). Use for 1:1 audio calls so the hidden
   * `<audio>` element is still mounted while CallStatusOverlay provides the visible UI.
   */
  audioOnly?: boolean;
  /** Speaker volume 0–1; only applied to remote audio element. */
  audioVolume?: number;
  /** Total tiles in the current grid view — drives adaptive avatar sizing. */
  tileCount?: number;
  showNameLabel?: boolean;
}

const ParticipantTile = React.memo(function ParticipantTile({
  participantId,
  isLocal = false,
  audioOnly = false,
  audioVolume = 0.85,
  tileCount = 1,
  showNameLabel = true,
}: ParticipantTileProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  const {
    micStream,
    webcamOn,
    micOn,
    displayName,
    isActiveSpeaker,
  } = useParticipant(participantId);

  const name = displayName || 'Participant';
  const initial = name.trim().charAt(0).toUpperCase();

  // Attach mic stream to audio element (remote participants only — never local to avoid echo)
  useEffect(() => {
    if (isLocal) return;
    const el = audioRef.current;
    if (!el) return;
    if (micOn && micStream?.track) {
      const ms = new MediaStream([micStream.track]);
      el.srcObject = ms;
      el.volume = Math.min(1, Math.max(0, audioVolume));
      el.muted = false;
      el.play().catch(() => {});
    } else {
      el.srcObject = null;
    }
    return () => {
      if (el) el.srcObject = null;
    };
  }, [micStream, micOn, isLocal, audioVolume]);

  // Sync audio volume when speaker level changes without re-attaching stream
  useEffect(() => {
    if (!isLocal && audioRef.current) {
      audioRef.current.volume = Math.min(1, Math.max(0, audioVolume));
    }
  }, [audioVolume, isLocal]);

  if (audioOnly) {
    if (isLocal) return null;
    return <audio ref={audioRef} autoPlay playsInline className="hidden" />;
  }

  // Adaptive avatar size driven by grid density
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
      {/* Webcam — SDK's VideoPlayer handles all srcObject lifecycle internally */}
      {webcamOn && (
        <VideoPlayer
          participantId={participantId}
          type="video"
          className="absolute inset-0 w-full h-full"
          videoStyle={{
            objectFit: 'cover',
            transform: isLocal ? 'scaleX(-1) translateZ(0)' : 'translateZ(0)',
            willChange: 'transform',
            backfaceVisibility: 'hidden',
          }}
        />
      )}

      {/* Avatar placeholder — shown when camera is off */}
      {!webcamOn && (
        <div className="absolute inset-0 flex items-center justify-center">
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
        </div>
      )}

      {/* Remote audio — manual element so we can control volume */}
      {!isLocal && (
        <audio ref={audioRef} autoPlay playsInline className="hidden" />
      )}

      {/* Name label with muted mic indicator */}
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

      {/* Active speaker pulse indicator */}
      {isActiveSpeaker && !isLocal && (
        <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-lg" />
      )}
    </div>
  );
});

export default ParticipantTile;
