'use client';

import React from 'react';
import { Copy, MicOff, UserPlus, X } from '@/shared/icons';
import type { NormalizedParticipant } from '@/features/video/core/models';
import { participantInitial } from '@/features/video/core/models';
import AudioActivityBars from './AudioActivityBars';

export interface ParticipantsSidebarItem extends NormalizedParticipant {
  isHost?: boolean;
}

export interface ParticipantsSidebarProps {
  open: boolean;
  participants: ParticipantsSidebarItem[];
  hostId?: string | null;
  onClose: () => void;
  onAddPeople: () => void;
  onCopyLink?: () => void;
  onMuteParticipant?: (participantId: string, displayName: string) => void;
  canManageParticipants?: boolean;
}

function roleLabel(p: ParticipantsSidebarItem, hostId?: string | null): string {
  if (p.isHost || (hostId && p.id === hostId)) return 'Meeting host';
  if (p.isLocal) return 'You';
  return 'Participant';
}

const ParticipantsSidebar: React.FC<ParticipantsSidebarProps> = ({
  open,
  participants,
  hostId,
  onClose,
  onAddPeople,
  onCopyLink,
  onMuteParticipant,
  canManageParticipants = false,
}) => {
  if (!open) return null;

  const count = participants.length;

  return (
    <>
      <button
        type="button"
        className="absolute inset-0 z-40 bg-black/50 backdrop-blur-[2px] sm:hidden"
        aria-label="Close people panel"
        onClick={onClose}
      />
      <aside
        className="absolute inset-y-0 right-0 z-50 flex w-full max-w-full flex-col border-l border-white/10 bg-[#121212] shadow-2xl animate-[slideLeft_280ms_ease-out] sm:w-[320px] sm:max-w-[40vw]"
        aria-label="People in call"
      >
        <header className="flex shrink-0 items-center justify-between gap-2 px-4 py-3.5">
          <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-semibold text-white">
            People ({count})
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white"
            aria-label="Close people panel"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-2 pb-3">
          {participants.map((p) => {
            const name = p.displayName || 'Participant';
            const label = p.isLocal ? `${name} (You)` : name;
            const speaking = p.isActiveSpeaker && p.isMicOn;
            const host = p.isHost || (hostId != null && p.id === hostId);
            const initial = participantInitial(name);

            return (
              <div
                key={p.id}
                className="group flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition hover:bg-white/[0.04]"
              >
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-primary-600/80 ring-1 ring-white/10">
                  {p.avatarUrl ? (
                    <img src={p.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-white">
                      {initial}
                    </span>
                  )}
                  {speaking ? (
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#121212] bg-emerald-400" />
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-white">{label}</div>
                  <div
                    className={`truncate text-xs ${
                      speaking ? 'text-emerald-400' : 'text-white/45'
                    }`}
                  >
                    {speaking ? 'Speaking now' : roleLabel({ ...p, isHost: host }, hostId)}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {speaking ? (
                    <AudioActivityBars active className="text-emerald-400" size="md" />
                  ) : !p.isMicOn ? (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500/15 text-red-400">
                      <MicOff className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-emerald-400/80" aria-hidden />
                  )}

                  {canManageParticipants && !p.isLocal && onMuteParticipant && p.isMicOn ? (
                    <button
                      type="button"
                      onClick={() => onMuteParticipant(p.id, name)}
                      className="rounded-lg px-2 py-1 text-[11px] font-medium text-white/55 opacity-0 transition hover:bg-white/10 hover:text-white group-hover:opacity-100"
                      title="Mute participant"
                    >
                      Mute
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <div className="shrink-0 space-y-2 border-t border-white/10 p-3">
          <button
            type="button"
            onClick={onAddPeople}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-transparent px-3 py-2.5 text-sm font-medium text-white/80 transition hover:border-primary-400/50 hover:bg-primary-500/10 hover:text-white"
          >
            <UserPlus className="h-4 w-4" aria-hidden />
            Add people
          </button>
          {onCopyLink ? (
            <button
              type="button"
              onClick={onCopyLink}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <Copy className="h-4 w-4" aria-hidden />
              Copy invitation link
            </button>
          ) : null}
        </div>
      </aside>
    </>
  );
};

export default ParticipantsSidebar;
