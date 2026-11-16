'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Hand, MicOff, MoreHorizontal } from '@/shared/icons';
import Portal from '@/shared/components/ui/Portal';
import type { NormalizedParticipant } from '@/features/video/core/models';
import { participantInitial } from '@/features/video/core/models';
import NetworkQualityIndicator from './NetworkQualityIndicator';

export interface ParticipantInfoProps {
  participant: Pick<
    NormalizedParticipant,
    | 'displayName'
    | 'isLocal'
    | 'isMicOn'
    | 'isCameraOn'
    | 'avatarUrl'
    | 'handRaised'
    | 'connectionQuality'
  >;
  tileCount?: number;
  showNameLabel?: boolean;
  isHost?: boolean;
  onMute?: () => void;
}

function ChipOverflowMenu({
  name,
  onMute,
}: {
  name: string;
  onMute: () => void;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const updatePosition = () => {
    const el = buttonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({ top: rect.top, left: el.getBoundingClientRect().left });
  };

  const toggleMenu = (event: React.MouseEvent | React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (open) {
      setOpen(false);
      return;
    }
    updatePosition();
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onReposition = () => setOpen(false);

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`More actions for ${name}`}
        onPointerDown={toggleMenu}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-white/80 transition hover:bg-white/15 ${
          open
            ? 'opacity-100'
            : 'opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100'
        }`}
      >
        <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
      </button>
      {open && coords ? (
        <Portal>
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-[10050] min-w-[12rem] overflow-hidden rounded-xl border border-white/10 bg-[#1a1a1a] py-1 text-sm text-white shadow-2xl"
            style={{
              top: coords.top,
              left: coords.left,
              transform: 'translateY(calc(-100% - 6px))',
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white/10"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setOpen(false);
                onMute();
              }}
            >
              <MicOff className="h-4 w-4 text-white/70" aria-hidden />
              Mute participant
            </button>
          </div>
        </Portal>
      ) : null}
    </>
  );
}

/** Provider-agnostic participant chrome (avatar, name, mute, network). */
const ParticipantInfo = React.memo(function ParticipantInfo({
  participant,
  tileCount = 1,
  showNameLabel = true,
  isHost = false,
  onMute,
}: ParticipantInfoProps) {
  const {
    displayName,
    isLocal,
    isMicOn,
    avatarUrl,
    handRaised,
    connectionQuality,
  } = participant;
  const name = displayName || 'Participant';
  const initial = participantInitial(name);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [avatarUrl]);

  const avatarSizeClass =
    tileCount <= 1
      ? 'w-28 h-28 sm:w-32 sm:h-32 md:w-36 md:h-36 text-3xl sm:text-4xl'
      : tileCount <= 2
        ? 'w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 text-2xl sm:text-3xl'
        : tileCount <= 4
          ? 'w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 text-xl sm:text-2xl'
          : tileCount <= 9
            ? 'w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-base sm:text-lg'
            : 'w-10 h-10 sm:w-12 sm:h-12 text-sm';

  const displayLabel = isLocal ? `${name === 'You' ? 'You' : `${name} (You)`}` : name;

  return (
    <>
      {!participant.isCameraOn && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#141414]">
          {avatarUrl && !avatarLoadFailed ? (
            <img
              src={avatarUrl}
              alt=""
              className={`rounded-full object-cover ring-2 ring-white/10 ${avatarSizeClass}`}
              onError={() => setAvatarLoadFailed(true)}
            />
          ) : (
            <div
              className={`flex items-center justify-center rounded-full ring-2 ring-white/10 ${avatarSizeClass}`}
              style={{
                background: isLocal
                  ? 'linear-gradient(135deg, #f97316, #ea580c)'
                  : 'linear-gradient(135deg, #16a34a, #15803d)',
              }}
            >
              <span className="font-semibold text-white">{initial}</span>
            </div>
          )}
        </div>
      )}

      {handRaised ? (
        <div
          className="absolute left-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-amber-950 shadow-lg call-hand-pulse sm:h-8 sm:w-8"
          title="Hand raised"
          aria-label={`${isLocal ? 'You' : name} raised a hand`}
        >
          <Hand className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
        </div>
      ) : null}

      {showNameLabel && (
        <div className="absolute bottom-2 left-2 z-30 flex max-w-[calc(100%-16px)] items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-2 py-1 text-[10px] text-white/90 backdrop-blur-md sm:bottom-2.5 sm:left-2.5 sm:text-xs">
          {isLocal ? (
            <NetworkQualityIndicator
              quality={connectionQuality}
              size="sm"
              embedded
              className="flex-shrink-0"
            />
          ) : null}
          {!isMicOn ? (
            <span
              className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-red-500 text-white"
              title="Muted"
              aria-label="Muted"
            >
              <MicOff className="h-2.5 w-2.5" aria-hidden />
            </span>
          ) : (
            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" aria-hidden />
          )}
          <span className="truncate font-medium">{displayLabel}</span>
          {isHost ? (
            <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/70">
              Host
            </span>
          ) : null}
          {onMute && !isLocal ? <ChipOverflowMenu name={name} onMute={onMute} /> : null}
        </div>
      )}

      {!showNameLabel && !isMicOn && (
        <div
          className="absolute bottom-1.5 left-1.5 z-30 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-md sm:bottom-2 sm:left-2 sm:h-7 sm:w-7"
          title="Muted"
          aria-label={`${isLocal ? 'You are' : `${name} is`} muted`}
        >
          <MicOff className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden />
        </div>
      )}
    </>
  );
});

export default ParticipantInfo;
