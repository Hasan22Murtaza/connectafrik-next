/**
 * ScreenShareView — react-sdk aware screen share renderer.
 *
 * Replaces the old ScreenShareOverlay (which required raw MediaStream props).
 * Uses `useParticipant(presenterId)` internally to get the screen-share stream,
 * and renders `ParticipantTile` components in the side-panel — no MediaStream
 * wiring needed at the parent level.
 *
 * Renders two modes:
 * 1. `isLocalPresenting` — top banner "You are presenting" with a stop button.
 * 2. Remote presenter — full-screen content + Teams-style participant sidebar.
 */
import { MonitorUp } from 'lucide-react';
import React, { useState } from 'react';
import { VideoPlayer } from '@videosdk.live/react-sdk';
import ParticipantTile from './ParticipantTile';

export interface ScreenShareViewProps {
  /** The participant ID of whoever is presenting (remote or local). */
  presenterId: string;
  presenterName: string;
  /** All remote participant IDs (excluding the presenter for sidebar clarity). */
  remoteParticipantIds: string[];
  localParticipantId: string | null;
  /** True when the local user is the one presenting. */
  isLocalPresenting: boolean;
  callDuration: number;
  participantCount: number;
  formatDuration: (seconds: number) => string;
  audioVolume: number;
  onStopSharing: () => void;
}

const ScreenShareView: React.FC<ScreenShareViewProps> = ({
  presenterId,
  presenterName,
  remoteParticipantIds,
  localParticipantId,
  isLocalPresenting,
  callDuration,
  participantCount,
  formatDuration,
  audioVolume,
  onStopSharing,
}) => {
  const [sidebarPage, setSidebarPage] = useState(0);
  const MAX_PER_PAGE = 6;

  // Sidebar shows everyone except the remote presenter (they're already on the main view)
  const sidebarIds = isLocalPresenting
    ? remoteParticipantIds
    : [
        ...remoteParticipantIds.filter((id) => id !== presenterId),
        ...(localParticipantId ? [localParticipantId] : []),
      ];

  const pageCount = Math.max(1, Math.ceil(sidebarIds.length / MAX_PER_PAGE));
  const pageIndex = Math.min(sidebarPage, pageCount - 1);
  const visibleSidebar = sidebarIds.slice(
    pageIndex * MAX_PER_PAGE,
    pageIndex * MAX_PER_PAGE + MAX_PER_PAGE,
  );

  // Local-only: just show the "You are presenting" banner, overlay stays transparent
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

  // Remote presenter — full Teams-style layout
  return (
    <div className="absolute inset-0 z-20 bg-gray-950 flex flex-col animate-[fadeIn_300ms_ease-out]">
      {/* Top bar: presenter info + call metadata */}
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

      {/* Main content area */}
      <div className="flex-1 flex min-h-0">
        {/* Screen share content — SDK's VideoPlayer handles stream attachment */}
        <div className="flex-1 min-w-0 bg-black flex items-center justify-center">
          <VideoPlayer
            participantId={presenterId}
            type="share"
            className="w-full h-full"
            videoStyle={{ objectFit: 'contain', background: '#111827' }}
          />
        </div>

        {/* Participant sidebar — Teams-style right strip */}
        <div className="w-36 sm:w-44 md:w-52 bg-gray-900/95 backdrop-blur-sm flex flex-col gap-1.5 p-1.5 overflow-y-auto shrink-0 border-l border-gray-800 animate-[slideLeft_400ms_ease-out]">
          <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider px-1 py-0.5">
            Participants
          </div>

          {visibleSidebar.map((pid) => (
            <div
              key={pid}
              className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden border border-gray-700/50 shadow-sm hover:border-blue-500/50 transition-colors duration-300"
            >
              <ParticipantTile
                participantId={pid}
                isLocal={pid === localParticipantId}
                tileCount={visibleSidebar.length + 1}
                showNameLabel
                audioVolume={audioVolume}
              />
            </div>
          ))}

          {pageCount > 1 && (
            <div className="mt-1 flex items-center justify-center gap-1.5 px-1">
              <button
                onClick={() => setSidebarPage((p) => Math.max(0, p - 1))}
                disabled={pageIndex === 0}
                className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-white hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Previous participants"
              >
                Prev
              </button>
              <span className="text-[10px] text-gray-300 tabular-nums">
                {pageIndex + 1}/{pageCount}
              </span>
              <button
                onClick={() => setSidebarPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={pageIndex >= pageCount - 1}
                className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-white hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Next participants"
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

export default ScreenShareView;
