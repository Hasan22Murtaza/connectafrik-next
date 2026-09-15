import React from 'react';
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
        <div className="text-base sm:text-lg md:text-xl font-semibold">Ringing...</div>
        <div className="text-xs sm:text-sm text-content-secondary mt-1">Waiting for answer</div>
      </>
    ) : callStatus === 'connecting' || callStatus === 'connecting_media' ? (
      <div className="text-base sm:text-lg md:text-xl font-semibold">Connecting...</div>
    ) : callStatus === 'reconnecting' ? (
      <>
        <div className="text-base sm:text-lg md:text-xl font-semibold">Reconnecting...</div>
        <div className="text-xs sm:text-sm text-content-secondary mt-1">
          {formatDuration(callDuration)} · network issue
        </div>
      </>
    ) : callStatus === 'connected' ? (
      <div className="text-xs sm:text-sm md:text-base font-bold tracking-wider text-content font-mono tabular-nums">
        {formatDuration(callDuration)}
      </div>
    ) : null;

  return (
    <div
      className={`absolute inset-0 pointer-events-none px-4 ${
        isAudioConnectedTopLayout ? 'flex justify-center items-start pt-24 sm:pt-28 md:pt-32' : ''
      }`}
    >
      {callStatus === 'reconnecting' && videoSurfaceUp && (
        <div className="absolute top-16 left-0 right-0 flex justify-center z-10">
          <div className="rounded-full bg-black/70 text-white text-xs sm:text-sm font-medium px-3 py-1.5 backdrop-blur-sm border border-white/15">
            Reconnecting…
          </div>
        </div>
      )}

      {showPersonChrome && (
        <div
          className={`text-center text-content ${
            isAudioConnectedTopLayout ? '' : 'absolute inset-0 flex justify-center items-center'
          }`}
        >
          <div className={callStatus === 'ringing' ? 'animate-pulse' : ''}>
            <div className="mb-3 sm:mb-4">
              <div className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold break-words px-2">
                {activeName}
              </div>
            </div>
            <div className="mb-3 sm:mb-4 flex justify-center">
              {activeAvatarUrl ? (
                <img
                  src={activeAvatarUrl}
                  alt={activeName}
                  className="h-20 w-20 sm:h-24 sm:w-24 rounded-full object-cover border-4 border-border-subtle shadow-xl"
                />
              ) : (
                <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-surface-secondary text-content border-4 border-border-subtle shadow-xl flex items-center justify-center text-2xl sm:text-3xl font-bold">
                  {activeInitial}
                </div>
              )}
            </div>
            {personFooter}
          </div>
        </div>
      )}

      {callStatus === 'ended' && (
        <div className="absolute inset-0 flex justify-center items-center">
          <div className="text-center text-content">
            <div className="text-lg sm:text-xl font-semibold mb-1">Call Ended</div>
            <div className="text-xs sm:text-sm text-content-secondary">
              Duration: {formatDuration(callDuration)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CallStatusOverlay;
