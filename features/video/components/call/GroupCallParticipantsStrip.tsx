'use client';

import React from 'react';

export interface CallParticipantProfile {
  id: string;
  full_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
}

interface GroupCallParticipantsStripProps {
  profiles: CallParticipantProfile[];
  totalCount: number;
  maxVisible?: number;
}

function displayName(p: CallParticipantProfile): string {
  return (p.full_name || p.username || 'User').trim();
}

function initial(p: CallParticipantProfile): string {
  const n = displayName(p);
  return n ? n.charAt(0).toUpperCase() : '?';
}

const GroupCallParticipantsStrip: React.FC<GroupCallParticipantsStripProps> = ({
  profiles,
  totalCount,
  maxVisible = 5,
}) => {
  if (totalCount <= 0) return null;

  const visible = profiles.slice(0, maxVisible);
  const overflow = Math.max(0, totalCount - visible.length);

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1.5 pointer-events-none">
      <div className="flex items-center -space-x-2">
        {visible.map((p) => (
          <div
            key={p.id}
            className="relative h-9 w-9 rounded-full border-2 border-white shadow-md overflow-hidden bg-primary-100"
            title={displayName(p)}
          >
            {p.avatar_url ? (
              <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-xs font-semibold text-primary-700">
                {initial(p)}
              </span>
            )}
          </div>
        ))}
        {overflow > 0 && (
          <div className="relative flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-black/60 text-[11px] font-semibold text-white shadow-md">
            +{overflow}
          </div>
        )}
      </div>
      <span className="rounded-full bg-black/50 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
        {totalCount} in call
      </span>
    </div>
  );
};

export default GroupCallParticipantsStrip;
