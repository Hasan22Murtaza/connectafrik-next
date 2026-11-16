import {
  Hand,
  MessageSquare,
  Mic,
  MicOff,
  MonitorOff,
  MonitorUp,
  Phone,
  Settings,
  Smile,
  Users,
  Video,
  VideoOff,
} from '@/shared/icons';
import React, { useEffect, useRef, useState } from 'react';
import type { SpeakerLevel } from '@/features/video/core/types';
import { CALL_LIVE_REACTIONS } from '@/features/video/core/callEngagement';
import { CALL_CONTROL_BAR_BG } from './callTheme';

interface CallControlsProps {
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  remoteScreenShareStream: MediaStream | null;
  screenShareParticipantName: string;
  speakerLevel: SpeakerLevel;
  callType: 'audio' | 'video';
  showMessageInput: boolean;
  showAddPeople: boolean;
  showParticipants?: boolean;
  showSettings?: boolean;
  participantCount?: number;
  isGroupCall?: boolean;
  handRaised?: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleSpeaker: () => void;
  onToggleMessageInput: () => void;
  onToggleAddPeople: () => void;
  onToggleParticipants?: () => void;
  onToggleSettings?: () => void;
  onToggleHand?: () => void;
  onSendReaction?: (emoji: string) => void;
  onEndCall: () => void;
  onEndCallForAll?: () => void;
  networkIndicator?: React.ReactNode;
}

const ctrlBtn =
  'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none touch-manipulation sm:h-11 sm:w-11';
const ctrlBtnActive = 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300';
const ctrlBtnOff = 'bg-red-500/15 text-red-400 hover:bg-red-500/25 hover:text-red-300';

const CallControls: React.FC<CallControlsProps> = ({
  isMuted,
  isVideoEnabled,
  isScreenSharing,
  remoteScreenShareStream,
  screenShareParticipantName,
  callType,
  showMessageInput,
  showParticipants = false,
  showSettings = false,
  participantCount = 0,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onToggleMessageInput,
  onToggleParticipants,
  onToggleSettings,
  onToggleHand,
  onSendReaction,
  onEndCall,
  onEndCallForAll,
  isGroupCall = false,
  handRaised = false,
}) => {
  const screenShareDisabled = !!remoteScreenShareStream && !isScreenSharing;
  const cameraOn = callType === 'video' && isVideoEnabled;
  const videoButtonTitle =
    callType === 'audio'
      ? 'Switch to video'
      : isVideoEnabled
        ? 'Turn off camera'
        : 'Turn on camera';
  const endCallLabel = isGroupCall ? 'Leave' : 'Leave';
  const [reactionOpen, setReactionOpen] = useState(false);
  const [leaveMenuOpen, setLeaveMenuOpen] = useState(false);
  const reactionWrapRef = useRef<HTMLDivElement>(null);
  const leaveWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!reactionOpen && !leaveMenuOpen) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (reactionOpen && reactionWrapRef.current && !reactionWrapRef.current.contains(target)) {
        setReactionOpen(false);
      }
      if (leaveMenuOpen && leaveWrapRef.current && !leaveWrapRef.current.contains(target)) {
        setLeaveMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [reactionOpen, leaveMenuOpen]);

  const handleLeaveClick = () => {
    if (onEndCallForAll) {
      setLeaveMenuOpen((open) => !open);
      return;
    }
    onEndCall();
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-center px-2 pb-[max(0.85rem,env(safe-area-inset-bottom,0px))] sm:px-4">
      <div
        className={`pointer-events-auto flex max-w-full items-center gap-0.5 rounded-full border border-white/10 px-1.5 py-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl [scrollbar-width:none] sm:gap-1 sm:px-2 sm:py-2 [&::-webkit-scrollbar]:hidden ${
          reactionOpen || leaveMenuOpen
            ? 'overflow-visible'
            : 'overflow-x-auto'
        }`}
        style={{ background: CALL_CONTROL_BAR_BG }}
        role="toolbar"
        aria-label="Call controls"
      >
        <button
          onClick={onToggleMute}
          className={`${ctrlBtn} ${isMuted ? ctrlBtnOff : ctrlBtnActive}`}
          title={isMuted ? 'Unmute' : 'Mute'}
          aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>

        <button
          onClick={onToggleVideo}
          className={`${ctrlBtn} ${cameraOn ? ctrlBtnActive : 'text-white/70'}`}
          title={videoButtonTitle}
          aria-label={videoButtonTitle}
        >
          {cameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </button>

        <button
          onClick={onToggleScreenShare}
          disabled={screenShareDisabled}
          className={`${ctrlBtn} ${
            screenShareDisabled
              ? 'cursor-not-allowed opacity-35 hover:bg-transparent'
              : isScreenSharing
                ? ctrlBtnActive
                : ''
          }`}
          title={
            screenShareDisabled
              ? `${screenShareParticipantName} is already presenting`
              : isScreenSharing
                ? 'Stop sharing'
                : 'Share screen'
          }
          aria-label={
            screenShareDisabled
              ? 'Screen share unavailable - someone is presenting'
              : isScreenSharing
                ? 'Stop sharing screen'
                : 'Share screen'
          }
        >
          {isScreenSharing ? (
            <MonitorOff className="h-5 w-5" />
          ) : (
            <MonitorUp className="h-5 w-5" />
          )}
        </button>

        {onSendReaction ? (
          <div className="relative z-50" ref={reactionWrapRef}>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setLeaveMenuOpen(false);
                setReactionOpen((open) => !open);
              }}
              className={`${ctrlBtn} ${reactionOpen ? ctrlBtnActive : ''}`}
              title="Send a reaction"
              aria-label="Send a reaction"
              aria-expanded={reactionOpen}
              aria-haspopup="true"
            >
              <Smile className="h-5 w-5" />
            </button>
            {reactionOpen ? (
              <div
                className="absolute bottom-full left-1/2 z-[60] mb-2.5 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-0.5 overflow-x-auto rounded-full border border-white/10 bg-[#1a1a1a] px-1.5 py-1 shadow-2xl [scrollbar-width:none]"
                role="menu"
                aria-label="Live reactions"
              >
                {CALL_LIVE_REACTIONS.map((reaction) => (
                  <button
                    key={reaction.emoji}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onSendReaction(reaction.emoji);
                      setReactionOpen(false);
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-xl transition hover:bg-white/10 hover:scale-110 active:scale-95 noto-color-emoji-regular"
                    title={reaction.label}
                    aria-label={reaction.label}
                  >
                    {reaction.emoji}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {isGroupCall && onToggleHand ? (
          <button
            onClick={onToggleHand}
            className={`${ctrlBtn} ${handRaised ? 'bg-amber-400/20 text-amber-300 hover:bg-amber-400/25' : ''}`}
            title={handRaised ? 'Lower hand' : 'Raise hand'}
            aria-label={handRaised ? 'Lower hand' : 'Raise hand'}
            aria-pressed={handRaised}
          >
            <Hand className="h-5 w-5" />
          </button>
        ) : null}

        {onToggleParticipants ? (
          <button
            onClick={onToggleParticipants}
            className={`${ctrlBtn} ${showParticipants ? ctrlBtnActive : ''}`}
            title="People"
            aria-label="People in call"
            aria-pressed={showParticipants}
          >
            <Users className="h-5 w-5" />
            {participantCount > 0 ? (
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary-500 ring-2 ring-[#161616]" />
            ) : null}
          </button>
        ) : null}

        <button
          onClick={onToggleMessageInput}
          className={`${ctrlBtn} ${showMessageInput ? ctrlBtnActive : ''}`}
          title="Meeting chat"
          aria-label={showMessageInput ? 'Hide meeting chat' : 'Show meeting chat'}
          aria-pressed={showMessageInput}
        >
          <MessageSquare className="h-5 w-5" />
        </button>

        {onToggleSettings ? (
          <button
            onClick={onToggleSettings}
            className={`${ctrlBtn} ${showSettings ? ctrlBtnActive : ''}`}
            title="Call settings"
            aria-label="Call settings"
            aria-pressed={showSettings}
          >
            <Settings className="h-5 w-5" />
          </button>
        ) : null}

        <div className="relative ml-0.5 sm:ml-1" ref={leaveWrapRef}>
          <button
            onClick={handleLeaveClick}
            className="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-danger px-3.5 text-sm font-semibold text-white transition hover:opacity-90 focus:outline-none touch-manipulation sm:h-11 sm:px-4"
            title={endCallLabel}
            aria-label={endCallLabel}
            aria-haspopup={onEndCallForAll ? 'menu' : undefined}
            aria-expanded={onEndCallForAll ? leaveMenuOpen : undefined}
          >
            <Phone className="h-4 w-4 rotate-[135deg] sm:h-[18px] sm:w-[18px]" />
            <span className="hidden xs:inline sm:inline">{endCallLabel}</span>
          </button>

          {leaveMenuOpen && onEndCallForAll ? (
            <div
              className="absolute bottom-full right-0 z-50 mb-2.5 min-w-[11.5rem] overflow-hidden rounded-xl border border-white/10 bg-[#1a1a1a] py-1 shadow-2xl"
              role="menu"
            >
              <button
                type="button"
                role="menuitem"
                className="flex w-full px-3.5 py-2.5 text-left text-sm text-white/85 transition hover:bg-white/10"
                onClick={() => {
                  setLeaveMenuOpen(false);
                  onEndCall();
                }}
              >
                Leave call
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full px-3.5 py-2.5 text-left text-sm text-red-400 transition hover:bg-white/10"
                onClick={() => {
                  setLeaveMenuOpen(false);
                  if (
                    typeof window !== 'undefined' &&
                    window.confirm('End the call for everyone?')
                  ) {
                    onEndCallForAll();
                  }
                }}
              >
                End for everyone
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default CallControls;
