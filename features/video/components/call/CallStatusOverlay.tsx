import React from 'react';
import type { CallStatus } from './types';

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
}) => {
  const activeName = isIncoming ? decodedCallerName : decodedRecipientName;
  const activeAvatarUrl = (isIncoming ? decodedCallerAvatarUrl : decodedRecipientAvatarUrl) || '';
  const activeInitial = (activeName || 'U').trim().charAt(0).toUpperCase();
  const isAudioConnectedTopLayout =
    callStatus === 'connected' && callType === 'audio' && !remoteScreenShareStream && !isScreenSharing;

  return (
    <div
      className={`absolute inset-0 flex justify-center pointer-events-none px-4 ${
        isAudioConnectedTopLayout ? 'items-start pt-24 sm:pt-28 md:pt-32' : 'items-center'
      }`}
    >
      <div className="text-center text-slate-800">
        <div className="mb-4">
          {callStatus === 'connecting' && (
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14 border-3 sm:border-4 border-slate-700 border-t-transparent mb-2 sm:mb-3"></div>
              <div className="text-sm sm:text-base font-medium">Connecting...</div>
            </div>
          )}
          {callStatus === 'connecting_media' && (
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14 border-3 sm:border-4 border-slate-700 border-t-transparent mb-2 sm:mb-3"></div>
              <div className="text-sm sm:text-base font-medium">Connecting media...</div>
            </div>
          )}
          {callStatus === 'ringing' && (
            <div className="animate-pulse">
              <div className="mb-3 sm:mb-4">
                <div className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold break-words px-2">
                  {activeName}
                </div>
              </div>
              <div className="mb-2 sm:mb-3 flex justify-center">
                {activeAvatarUrl ? (
                  <img
                    src={activeAvatarUrl}
                    alt={activeName}
                    className="h-20 w-20 sm:h-24 sm:w-24 rounded-full object-cover border-4 border-slate-700/20 shadow-xl"
                  />
                ) : (
                  <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-slate-200 text-slate-800 border-4 border-slate-700/20 shadow-xl flex items-center justify-center text-2xl sm:text-3xl font-bold">
                    {activeInitial}
                  </div>
                )}
              </div>
              <div className="text-base sm:text-lg md:text-xl font-semibold">Ringing...</div>
              <div className="text-xs sm:text-sm text-slate-700 mt-1">Waiting for answer</div>
            </div>
          )}
          {callStatus === 'connected' && !remoteScreenShareStream && !isScreenSharing && (
            callType === 'audio' ? (
              <div className="flex flex-col items-center">
                <div className="mb-3 sm:mb-4">
                  {activeAvatarUrl ? (
                    <img
                      src={activeAvatarUrl}
                      alt={activeName}
                      className="h-20 w-20 sm:h-24 sm:w-24 rounded-full object-cover border-4 border-slate-700/20 shadow-xl"
                    />
                  ) : (
                    <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-slate-200 text-slate-800 border-4 border-slate-700/20 shadow-xl flex items-center justify-center text-2xl sm:text-3xl font-bold">
                      {activeInitial}
                    </div>
                  )}
                </div>
                <div className="text-xs sm:text-sm md:text-base font-bold tracking-wider text-slate-800 font-mono tabular-nums">
                  {formatDuration(callDuration)}
                </div>
              </div>
            ) : (
              <div className="space-y-2 flex">
                <div className="absolute bottom-0 left-2 sm:left-4 text-xs sm:text-sm md:text-base font-bold tracking-wider text-slate-800 font-mono tabular-nums z-30">{formatDuration(callDuration)}</div>
              </div>
            )
          )}
          {callStatus === 'ended' && (
            <div>
              <div className="text-lg sm:text-xl font-semibold mb-1">Call Ended</div>
              <div className="text-xs sm:text-sm text-slate-700">Duration: {formatDuration(callDuration)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallStatusOverlay;
