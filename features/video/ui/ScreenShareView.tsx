'use client';

import { MonitorUp } from '@/shared/icons';
import React, { useState } from 'react';
import type { NormalizedParticipant } from '@/features/video/core/models';

export interface ScreenShareViewProps {
  presenter: NormalizedParticipant;
  presenterName: string;
  sidebarParticipants: NormalizedParticipant[];
  isLocalPresenting: boolean;
  callDuration: number;
  participantCount: number;
  formatDuration: (seconds: number) => string;
  audioVolume: number;
  onStopSharing: () => void;
  /** Provider-specific screen share media element. */
  screenShareMedia: React.ReactNode;
  /** Render participant tile for sidebar. */
  renderParticipantTile: (
    participant: NormalizedParticipant,
    options: { tileCount: number; audioVolume: number },
  ) => React.ReactNode;
}

/**
 * Unified screen share UI — identical layout for all providers.
 */
const ScreenShareView: React.FC<ScreenShareViewProps> = ({
  presenterName,
  sidebarParticipants,
  isLocalPresenting,
  callDuration,
  participantCount,
  formatDuration,
  audioVolume,
  onStopSharing,
  screenShareMedia,
  renderParticipantTile,
}) => {
  const [sidebarPage, setSidebarPage] = useState(0);
  const MAX_PER_PAGE = 6;

  const pageCount = Math.max(1, Math.ceil(sidebarParticipants.length / MAX_PER_PAGE));
  const pageIndex = Math.min(sidebarPage, pageCount - 1);
  const visibleSidebar = sidebarParticipants.slice(
    pageIndex * MAX_PER_PAGE,
    pageIndex * MAX_PER_PAGE + MAX_PER_PAGE,
  );

  if (isLocalPresenting) {
    return (
      <div className="absolute top-14 left-0 right-0 z-20 flex items-center gap-2.5 border-b border-white/10 bg-primary-600/95 px-4 py-2.5 text-sm text-white shadow-lg sm:top-16">
        <div className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
        <MonitorUp className="h-4 w-4" />
        <span className="font-medium">You are presenting</span>
        <span className="ml-2 font-mono text-xs tabular-nums opacity-70">
          {formatDuration(callDuration)}
        </span>
        <button
          onClick={onStopSharing}
          className="ml-auto rounded-full bg-red-500 px-4 py-1.5 text-xs font-medium shadow-md transition hover:bg-red-600 hover:scale-105 active:scale-95"
        >
          Stop presenting
        </button>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-[#0b0b0b] animate-[fadeIn_300ms_ease-out]">
      <div className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-primary-600/95 px-4 py-2 text-sm text-white shadow-lg animate-[slideDown_300ms_ease-out]">
        <div className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
        <MonitorUp className="h-4 w-4" />
        <span className="font-medium">{presenterName} is presenting</span>
        <div className="ml-auto flex items-center gap-3">
          <span className="font-mono text-xs tabular-nums opacity-80">
            {formatDuration(callDuration)}
          </span>
          <span className="text-xs opacity-60">|</span>
          <span className="flex items-center gap-1 text-xs opacity-80">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {participantCount}
          </span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 items-center justify-center bg-black">
          {screenShareMedia}
        </div>

        <div className="flex w-36 shrink-0 flex-col gap-1.5 overflow-y-auto border-l border-white/10 bg-[#121212] p-1.5 backdrop-blur-sm animate-[slideLeft_400ms_ease-out] sm:w-44 md:w-52">
          <div className="px-1 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/40">
            Participants
          </div>

          {visibleSidebar.map((p) => (
            <div
              key={p.id}
              className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-[#1a1a1a] shadow-sm transition-colors duration-300 hover:border-emerald-400/40"
            >
              {renderParticipantTile(p, {
                tileCount: visibleSidebar.length + 1,
                audioVolume,
              })}
            </div>
          ))}

          {pageCount > 1 && (
            <div className="mt-1 flex items-center justify-center gap-1.5 px-1">
              <button
                onClick={() => setSidebarPage((pg) => Math.max(0, pg - 1))}
                disabled={pageIndex === 0}
                className="rounded bg-white/10 px-2 py-0.5 text-[10px] text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous participants"
              >
                Prev
              </button>
              <span className="text-[10px] tabular-nums text-white/40">
                {pageIndex + 1}/{pageCount}
              </span>
              <button
                onClick={() =>
                  setSidebarPage((pg) => Math.min(pageCount - 1, pg + 1))
                }
                disabled={pageIndex >= pageCount - 1}
                className="rounded bg-white/10 px-2 py-0.5 text-[10px] text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
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
