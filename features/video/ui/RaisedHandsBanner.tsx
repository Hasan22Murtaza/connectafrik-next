'use client';

import React from 'react';
import { Hand } from '@/shared/icons';
import type { RaisedHandEntry } from '@/features/video/core/callEngagement';

interface RaisedHandsBannerProps {
  hands: RaisedHandEntry[];
}

const RaisedHandsBanner: React.FC<RaisedHandsBannerProps> = ({ hands }) => {
  if (hands.length === 0) return null;

  const names = hands.map((h) => h.name);
  const summary =
    names.length === 1
      ? `${names[0]} raised a hand`
      : names.length === 2
        ? `${names[0]} and ${names[1]} raised hands`
        : `${names[0]} and ${names.length - 1} others raised hands`;

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-20 z-40 w-[min(92%,22rem)] -translate-x-1/2 sm:top-24"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 rounded-full border border-amber-300/40 bg-black/70 px-3 py-1.5 text-white shadow-lg backdrop-blur-md">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400 text-amber-950 call-hand-pulse">
          <Hand className="h-3.5 w-3.5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold leading-tight">{summary}</p>
          {names.length > 2 ? (
            <p className="truncate text-[10px] text-white/70">{names.join(', ')}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default RaisedHandsBanner;
