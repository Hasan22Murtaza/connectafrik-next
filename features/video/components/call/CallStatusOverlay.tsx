import React from 'react';
import type { CallStatus } from './types';

interface CallStatusOverlayProps {
  callStatus: CallStatus;
  callDuration: number;
  formatDuration: (seconds: number) => string;
  isIncoming: boolean;
  decodedCallerName: string;
  decodedRecipientName: string;
  isScreenSharing: boolean;
  remoteScreenShareStream: MediaStream | null;
}

const CallStatusOverlay: React.FC<CallStatusOverlayProps> = ({
  callStatus,
  callDuration,
  formatDuration,
  isIncoming,
  decodedCallerName,
  decodedRecipientName,
  isScreenSharing,
  remoteScreenShareStream,
}) => {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4">
      <div className="text-center text-white">
        <div className="mb-4">
          {callStatus === 'connecting' && (
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14 border-3 sm:border-4 border-white border-t-transparent mb-2 sm:mb-3"></div>
              <div className="text-sm sm:text-base font-medium">Connecting...</div>
            </div>
          )}
          {callStatus === 'ringing' && (
            <div className="animate-pulse">
              <div className="mb-3 sm:mb-4">
                <div className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold break-words px-2">
                  {isIncoming ? decodedCallerName : decodedRecipientName}
                </div>
              </div>
              <div className="text-4xl sm:text-5xl mb-2 sm:mb-3 animate-bounce">📞</div>
              <div className="text-base sm:text-lg md:text-xl font-semibold">Ringing...</div>
              <div className="text-xs sm:text-sm opacity-75 mt-1">Waiting for answer</div>
            </div>
          )}
          {callStatus === 'connected' && !remoteScreenShareStream && !isScreenSharing && (
            <div className="space-y-2 flex">
              <div className="absolute bottom-0 left-2 sm:left-4 text-xs sm:text-sm md:text-base font-bold tracking-wider text-gray-300 sm:text-gray-700 font-mono tabular-nums z-30">{formatDuration(callDuration)}</div>
            </div>
          )}
          {callStatus === 'ended' && (
            <div>
              <div className="text-lg sm:text-xl font-semibold mb-1">Call Ended</div>
              <div className="text-xs sm:text-sm opacity-75">Duration: {formatDuration(callDuration)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallStatusOverlay;
