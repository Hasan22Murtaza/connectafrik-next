import React from 'react';
import { Lock } from '@/shared/icons';
import type { CallStatus } from '@/features/video/core/types';

interface CallStatusOverlayProps {
  callStatus: CallStatus;
  callType: 'audio' | 'video';
  callDuration: number;
  formatDuration: (seconds: number) => string;
  isIncoming: boolean;
  decodedCallerName: string;
  decodedRecipientName: string;
  decodedCallerAvatarUrl?: string;
  decodedRecipientAvatarUrl?: string;
  isScreenSharing: boolean;
  remoteScreenShareStream: MediaStream | null;
  /** When true, audio calls use the same minimal overlay as video (timer only) — e.g. group grid */
  showConnectedGroupGallery?: boolean;
  /** Remote video tile/grid is already filling the surface — don't cover it with chrome. */
  remoteMediaVisible?: boolean;
  extraPersonChrome?: React.ReactNode;
  endToEndEncrypted?: boolean;
  /** Hide top name chrome when CallHeader already shows the title. */
  compactWhenMediaVisible?: boolean;
}

function EndToEndEncryptedLine({ onDark = false }: { onDark?: boolean }) {
  return (
    <div
      className={`mt-1 flex items-center justify-center gap-1 text-xs sm:text-sm ${
        onDark ? 'text-white/70 drop-shadow' : 'text-content-secondary'
      }`}
    >
      <Lock className="h-3.5 w-3.5" aria-hidden />
      <span>End-to-end encrypted</span>
    </div>
  );
}

const CallStatusOverlay: React.FC<CallStatusOverlayProps> = ({
  callStatus,
  callType,
  callDuration,
  formatDuration,
  isIncoming,
  decodedCallerName,
  decodedRecipientName,
  decodedCallerAvatarUrl,
  decodedRecipientAvatarUrl,
  isScreenSharing,
  remoteScreenShareStream,
  showConnectedGroupGallery = false,
  remoteMediaVisible = false,
  extraPersonChrome = null,
  endToEndEncrypted = false,
  compactWhenMediaVisible = true,
}) => {
  const activeName = isIncoming ? decodedCallerName : decodedRecipientName;
  const activeAvatarUrl = (isIncoming ? decodedCallerAvatarUrl : decodedRecipientAvatarUrl) || '';
  const activeInitial = (activeName || 'U').trim().charAt(0).toUpperCase();
  const isAudioConnectedTopLayout =
    (callStatus === 'connected' ||
      callStatus === 'connecting_media' ||
      callStatus === 'reconnecting') &&
    callType === 'audio' &&
    !remoteScreenShareStream &&
    !isScreenSharing &&
    !showConnectedGroupGallery;

  const videoSurfaceUp =
    remoteMediaVisible || !!remoteScreenShareStream || isScreenSharing || showConnectedGroupGallery;
  const onDarkVideo = true;

  const showPersonChrome =
    callStatus === 'ringing' ||
    callStatus === 'connecting' ||
    ((callStatus === 'connecting_media' ||
      callStatus === 'reconnecting' ||
      callStatus === 'connected') &&
      !videoSurfaceUp);

  const personFooter =
    callStatus === 'ringing' ? (
      <>
        <div className="text-base font-semibold text-white/90 sm:text-lg md:text-xl">Ringing...</div>
        <div className="mt-1 text-xs text-white/50 sm:text-sm">Waiting for answer</div>
      </>
    ) : callStatus === 'connecting' || callStatus === 'connecting_media' ? (
      <div className="text-base font-semibold text-white/90 sm:text-lg md:text-xl">Connecting...</div>
    ) : callStatus === 'reconnecting' ? (
      <>
        <div className="text-base font-semibold text-white/90 sm:text-lg md:text-xl">Reconnecting...</div>
        <div className="mt-1 text-xs text-white/50 sm:text-sm">
          {formatDuration(callDuration)} · network issue
        </div>
      </>
    ) : null;

  return (
    <div
      className={`absolute inset-0 pointer-events-none px-4 ${
        isAudioConnectedTopLayout ? 'flex items-center justify-center' : ''
      }`}
    >
      {endToEndEncrypted &&
        videoSurfaceUp &&
        callStatus !== 'ended' &&
        !compactWhenMediaVisible && (
          <div className="absolute top-4 left-0 right-0 z-10 flex justify-center px-4">
            <div className="text-center">
              <div
                className={`break-words text-base font-semibold sm:text-lg ${
                  onDarkVideo ? 'text-white drop-shadow-md' : 'text-content'
                }`}
              >
                {activeName}
              </div>
              <EndToEndEncryptedLine onDark={onDarkVideo} />
            </div>
          </div>
        )}

      {callStatus === 'reconnecting' && videoSurfaceUp && (
        <div className="absolute top-16 left-0 right-0 z-10 flex justify-center">
          <div className="rounded-full border border-white/15 bg-black/70 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm sm:text-sm">
            Reconnecting…
          </div>
        </div>
      )}

      {showPersonChrome && (
        <div
          className={`text-center text-white ${
            isAudioConnectedTopLayout ? '' : 'absolute inset-0 flex items-center justify-center'
          }`}
        >
          <div className={callStatus === 'ringing' ? 'animate-pulse' : ''}>
            <div className="mb-3 sm:mb-4">
              <div className="break-words px-2 text-lg font-bold sm:text-xl md:text-2xl lg:text-3xl">
                {activeName}
              </div>
              {endToEndEncrypted ? <EndToEndEncryptedLine onDark /> : null}
            </div>
            <div className="mb-4 flex justify-center sm:mb-5">
              {activeAvatarUrl ? (
                <img
                  src={activeAvatarUrl}
                  alt={activeName}
                  className="h-24 w-24 rounded-full object-cover shadow-2xl ring-2 ring-white/15 sm:h-28 sm:w-28 md:h-32 md:w-32"
                />
              ) : (
                <div
                  className="flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold text-white shadow-2xl ring-2 ring-white/15 sm:h-28 sm:w-28 sm:text-4xl md:h-32 md:w-32"
                  style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}
                >
                  {activeInitial}
                </div>
              )}
            </div>
            {personFooter}
            {extraPersonChrome}
          </div>
        </div>
      )}

      {callStatus === 'ended' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-white">
            <div className="mb-1 text-lg font-semibold sm:text-xl">Call Ended</div>
            <div className="text-xs text-white/55 sm:text-sm">
              Duration: {formatDuration(callDuration)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CallStatusOverlay;
