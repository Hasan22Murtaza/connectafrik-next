'use client';

import React from 'react';
import type { LiveCallReaction } from '@/features/video/core/callEngagement';

interface CallReactionOverlayProps {
  reactions: LiveCallReaction[];
}

const CallReactionOverlay: React.FC<CallReactionOverlayProps> = ({ reactions }) => {
  if (reactions.length === 0) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-40 overflow-hidden"
      aria-live="polite"
      aria-label="Live call reactions"
    >
      {reactions.map((reaction) => (
        <div
          key={reaction.key}
          className="absolute bottom-[22%] left-1/2 flex flex-col items-center call-reaction-float"
          style={{ marginLeft: reaction.offsetX }}
        >
          <span className="noto-color-emoji-regular text-4xl drop-shadow-lg sm:text-5xl" aria-hidden>
            {reaction.emoji}
          </span>
          <span className="mt-1 max-w-[9rem] truncate rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
            {reaction.name}
          </span>
        </div>
      ))}
    </div>
  );
};

export default CallReactionOverlay;
