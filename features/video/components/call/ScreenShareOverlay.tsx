import { MonitorUp } from 'lucide-react';
import React from 'react';
import type { CallStatus } from './types';
import ParticipantVideo from './ParticipantVideo';
import ScreenShareVideo from './ScreenShareVideo';

interface ScreenShareOverlayProps {
  remoteScreenShareStream: MediaStream | null;
  screenShareParticipantName: string;
  isScreenSharing: boolean;
  callDuration: number;
  formatDuration: (seconds: number) => string;
  getParticipantCount: () => number;
  localStream: MediaStream | null;
  callType: 'audio' | 'video';
  participants: any[];
  participantVideoMap: Map<string, MediaStream>;
  userInitial: string;
  onStopSharing: () => void;
}

const ScreenShareOverlay: React.FC<ScreenShareOverlayProps> = ({
  remoteScreenShareStream,
  screenShareParticipantName,
  isScreenSharing,
  callDuration,
  formatDuration,
  getParticipantCount,
  localStream,
  callType,
  participants,
  participantVideoMap,
  userInitial,
  onStopSharing,
}) => {
  return (
    <>
      {/* Teams-like Screen Share Layout: screen as main content, participants as sidebar thumbnails */}
      {remoteScreenShareStream && (
        <div className="absolute inset-0 z-20 bg-gray-950 flex flex-col animate-[fadeIn_300ms_ease-out]">
          {/* Top bar with presenter info + call timer */}
          <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm shrink-0 shadow-lg animate-[slideDown_300ms_ease-out]">
            <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
            <MonitorUp className="w-4 h-4" />
            <span className="font-medium">{screenShareParticipantName} is presenting</span>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-xs opacity-80 font-mono tabular-nums">{formatDuration(callDuration)}</span>
              <span className="text-xs opacity-60">|</span>
              <span className="flex items-center gap-1 text-xs opacity-80">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                {getParticipantCount()}
              </span>
            </div>
          </div>
          {/* Main content area: screen share + participant sidebar */}
          <div className="flex-1 flex min-h-0">
            {/* Screen share takes the main area */}
            <div className="flex-1 min-w-0 bg-black flex items-center justify-center relative">
              <ScreenShareVideo stream={remoteScreenShareStream} />
            </div>
            {/* Participant thumbnails sidebar (Teams-style right strip) */}
            <div className="w-36 sm:w-44 md:w-52 bg-gray-900/95 backdrop-blur-sm flex flex-col gap-1.5 p-1.5 overflow-y-auto shrink-0 border-l border-gray-800 animate-[slideLeft_400ms_ease-out]">
              <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider px-1 py-0.5">Participants</div>
              {/* Local video thumbnail */}
              {localStream && callType === 'video' && localStream.getVideoTracks().length > 0 ? (
                <div className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden border border-gray-700/50 shadow-sm transition-all duration-300 hover:border-blue-500/50">
                  <ParticipantVideo stream={localStream} />
                  <div className="absolute bottom-1 left-1 text-[9px] text-white bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded-md font-medium">
                    You
                  </div>
                </div>
              ) : (
                <div className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden border border-gray-700/50 shadow-sm flex items-center justify-center">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center">
                    <span className="text-xs sm:text-sm font-bold text-white">
                      {userInitial}
                    </span>
                  </div>
                  <div className="absolute bottom-1 left-1 text-[9px] text-white bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded-md font-medium">
                    You
                  </div>
                </div>
              )}
              {/* Remote participant thumbnails */}
              {participants.map((p: any) => {
                const videoStream = participantVideoMap.get(p.id);
                return (
                  <div key={p.id} className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden border border-gray-700/50 shadow-sm transition-all duration-300 hover:border-blue-500/50">
                    {videoStream ? (
                      <ParticipantVideo stream={videoStream} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-gray-800 to-gray-850">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center shadow-md">
                          <span className="text-xs sm:text-sm font-bold text-white">
                            {(p.displayName || 'U')[0].toUpperCase()}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="absolute bottom-1 left-1 text-[9px] text-white bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded-md truncate max-w-[90%] font-medium">
                      {p.displayName || 'Participant'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Local screen sharing banner with Teams-style indicator */}
      {isScreenSharing && !remoteScreenShareStream && (
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-2.5 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm shadow-lg animate-[slideDown_300ms_ease-out]">
          <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
          <MonitorUp className="w-4 h-4" />
          <span className="font-medium">You are presenting</span>
          <span className="text-xs opacity-60 font-mono tabular-nums">{formatDuration(callDuration)}</span>
          <button
            onClick={onStopSharing}
            className="ml-auto text-xs bg-red-500 hover:bg-red-600 active:bg-red-700 px-4 py-1.5 rounded-full font-medium transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 active:scale-95"
          >
            Stop presenting
          </button>
        </div>
      )}
    </>
  );
};

export default ScreenShareOverlay;
