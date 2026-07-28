/**
 * LiveKit screen share view — matches VideoSDK ScreenShareView layout.
 */
'use client';

import { MonitorUp } from 'lucide-react';
import React, { useState } from 'react';
import { VideoTrack } from '@livekit/components-react';
import type { Participant } from 'livekit-client';
import { Track } from 'livekit-client';
import LiveKitParticipantTile from './LiveKitParticipantTile';

export interface LiveKitScreenShareViewProps {
  presenter: Participant;
  presenterName: string;
  sidebarParticipants: Participant[];
  localParticipant: Participant;
  isLocalPresenting: boolean;
  callDuration: number;
  participantCount: number;
  formatDuration: (seconds: number) => string;
  audioVolume: number;
  onStopSharing: () => void;
}

const LiveKitScreenShareView: React.FC<LiveKitScreenShareViewProps> = ({
  presenter,
  presenterName,
  sidebarParticipants,
  localParticipant,
  isLocalPresenting,
  callDuration,
  participantCount,
  formatDuration,
  audioVolume,
  onStopSharing,
}) => {
  const [sidebarPage, setSidebarPage] = useState(0);
  const MAX_PER_PAGE = 6;

  const pageCount = Math.max(1, Math.ceil(sidebarParticipants.length / MAX_PER_PAGE));
  const pageIndex = Math.min(sidebarPage, pageCount - 1);
  const visibleSidebar = sidebarParticipants.slice(
    pageIndex * MAX_PER_PAGE,
    pageIndex * MAX_PER_PAGE + MAX_PER_PAGE,
  );

  const screenPub = presenter.getTrackPublication(Track.Source.ScreenShare);

  if (isLocalPresenting) {
    return (
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-2.5 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm shadow-lg">
        <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
        <MonitorUp className="w-4 h-4" />
        <span className="font-medium">You are presenting</span>
        <span className="text-xs opacity-60 font-mono tabular-nums ml-2">
          {formatDuration(callDuration)}
        </span>
        <button
          onClick={onStopSharing}
          className="ml-auto text-xs bg-red-500 hover:bg-red-600 active:bg-red-700 px-4 py-1.5 rounded-full font-medium transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 active:scale-95"
        >
          Stop presenting
        </button>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-20 bg-gray-950 flex flex-col animate-[fadeIn_300ms_ease-out]">
      <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm shrink-0 shadow-lg animate-[slideDown_300ms_ease-out]">
        <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
        <MonitorUp className="w-4 h-4" />
        <span className="font-medium">{presenterName} is presenting</span>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs opacity-80 font-mono tabular-nums">
            {formatDuration(callDuration)}
          </span>
          <span className="text-xs opacity-60">|</span>
          <span className="flex items-center gap-1 text-xs opacity-80">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
            {participantCount}
          </span>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 min-w-0 bg-black flex items-center justify-center">
          {screenPub?.track ? (
            <VideoTrack
              trackRef={{
                participant: presenter,
                publication: screenPub,
                source: Track.Source.ScreenShare,
              }}
              className="w-full h-full"
              style={{ objectFit: 'contain', background: '#111827' }}
            />
          ) : (
            <div className="text-white/60 text-sm">Waiting for screen share…</div>
          )}
        </div>

        <div className="w-36 sm:w-44 md:w-52 bg-gray-900/95 backdrop-blur-sm flex flex-col gap-1.5 p-1.5 overflow-y-auto shrink-0 border-l border-gray-800 animate-[slideLeft_400ms_ease-out]">
          <div className="text-[10px] text-content-tertiary font-medium uppercase tracking-wider px-1 py-0.5">
            Participants
          </div>

          {visibleSidebar.map((p) => (
            <div
              key={p.identity}
              className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden border border-gray-700/50 shadow-sm hover:border-blue-500/50 transition-colors duration-300"
            >
              <LiveKitParticipantTile
                participant={p}
                isLocal={p.identity === localParticipant.identity}
                tileCount={visibleSidebar.length}
                showNameLabel
                audioVolume={audioVolume}
              />
            </div>
          ))}

          {pageCount > 1 && (
            <div className="flex items-center justify-between gap-1 pt-1">
              <button
                type="button"
                onClick={() => setSidebarPage((p) => Math.max(0, p - 1))}
                disabled={pageIndex === 0}
                className="text-[10px] px-2 py-1 rounded bg-surface/10 text-white/80 disabled:opacity-40"
              >
                Prev
              </button>
              <span className="text-[10px] text-white/60 tabular-nums">
                {pageIndex + 1}/{pageCount}
              </span>
              <button
                type="button"
                onClick={() => setSidebarPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={pageIndex >= pageCount - 1}
                className="text-[10px] px-2 py-1 rounded bg-surface/10 text-white/80 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveKitScreenShareView;
