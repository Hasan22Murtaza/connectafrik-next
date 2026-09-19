import {
  Hand,
  MessageSquare,
  Mic,
  MicOff,
  MonitorOff,
  MonitorUp,
  Phone,
  Smile,
  UserPlus,
  Video,
  VideoOff,
  Volume1,
  Volume2,
} from '@/shared/icons';
import React, { useEffect, useRef, useState } from 'react';
import type { SpeakerLevel } from '@/features/video/core/types';
import { CALL_LIVE_REACTIONS } from '@/features/video/core/callEngagement';

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
  isGroupCall?: boolean;
  handRaised?: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleSpeaker: () => void;
  onToggleMessageInput: () => void;
  onToggleAddPeople: () => void;
  onToggleHand?: () => void;
  onSendReaction?: (emoji: string) => void;
  onEndCall: () => void;
  onEndCallForAll?: () => void;
  networkIndicator?: React.ReactNode;
}

const iconBtn =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-content-secondary transition hover:bg-surface-hover hover:text-content focus:outline-none touch-manipulation sm:h-10 sm:w-10';
const iconBtnActive = 'bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary';
const devicePillOn = 'bg-surface-secondary text-content hover:bg-surface-tertiary';
const devicePillOff = 'bg-primary text-content-inverse hover:bg-primary-hover';
const glassCluster =
  'flex items-center gap-0.5 rounded-full border border-white/70 bg-surface/60 px-1 py-1 shadow-[0_8px_24px_rgba(0,0,0,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-surface/70 sm:gap-1.5 sm:px-2 sm:py-2';

const CallControls: React.FC<CallControlsProps> = ({
  isMuted,
  isVideoEnabled,
  isScreenSharing,
  remoteScreenShareStream,
  screenShareParticipantName,
  speakerLevel,
  callType,
  showMessageInput,
  showAddPeople,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onToggleSpeaker,
  onToggleMessageInput,
  onToggleAddPeople,
  onToggleHand,
  onSendReaction,
  onEndCall,
  onEndCallForAll,
  networkIndicator,
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
  const endCallLabel = isGroupCall ? 'Leave call' : 'End call';
  const [reactionOpen, setReactionOpen] = useState(false);
  const reactionWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!reactionOpen) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const el = reactionWrapRef.current;
      if (el && event.target instanceof Node && !el.contains(event.target)) {
        setReactionOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [reactionOpen]);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40">
      {onEndCallForAll && (
        <div className="pointer-events-auto flex justify-center px-3 pb-2 sm:justify-end sm:px-5">
          <button
            type="button"
            onClick={onEndCallForAll}
            className="rounded-full border border-white/70 bg-surface/60 px-3 py-1 text-xs font-medium text-content-secondary shadow-[0_8px_24px_rgba(0,0,0,0.08)] backdrop-blur-xl transition hover:text-content dark:border-white/10 dark:bg-surface/70"
          >
            End call for everyone
          </button>
        </div>
      )}

      <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-2 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:grid sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-end sm:gap-3 sm:px-5">
        <div className={`${glassCluster} order-1 justify-self-start`}>
          <button
            onClick={onToggleVideo}
            className={`flex h-10 shrink-0 items-center justify-center rounded-full px-2.5 transition focus:outline-none touch-manipulation sm:h-12 sm:px-4 ${
              cameraOn ? devicePillOn : devicePillOff
            }`}
            title={videoButtonTitle}
            aria-label={videoButtonTitle}
          >
            {cameraOn ? (
              <Video className="h-5 w-5" />
            ) : (
              <VideoOff className="h-5 w-5" />
            )}
          </button>

          <button
            onClick={onToggleMute}
            className={`flex h-10 shrink-0 items-center justify-center rounded-full px-2.5 transition focus:outline-none touch-manipulation sm:h-12 sm:px-4 ${
              isMuted ? devicePillOff : devicePillOn
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
            aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
        </div>

        <div className={`${glassCluster} order-3 min-w-0 max-w-full basis-full justify-center overflow-x-auto [scrollbar-width:none] sm:order-2 sm:basis-auto sm:justify-center [&::-webkit-scrollbar]:hidden`}>
          {onSendReaction ? (
            <div className="relative" ref={reactionWrapRef}>
              <button
                onClick={() => setReactionOpen((open) => !open)}
                className={`${iconBtn} ${reactionOpen ? iconBtnActive : ''}`}
                title="Send a reaction"
                aria-label="Send a reaction"
                aria-expanded={reactionOpen}
                aria-haspopup="true"
              >
                <Smile className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
              {reactionOpen ? (
                <div
                  className="absolute bottom-full left-1/2 z-50 mb-2 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-0.5 overflow-x-auto rounded-full border border-border bg-surface px-1.5 py-1 shadow-dropdown [scrollbar-width:none]"
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
                      className="flex h-9 w-9 items-center justify-center rounded-full text-xl transition hover:bg-surface-hover hover:scale-110 active:scale-95 noto-color-emoji-regular"
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

          <button
            onClick={onToggleScreenShare}
            disabled={screenShareDisabled}
            className={`${iconBtn} ${
              screenShareDisabled
                ? 'cursor-not-allowed opacity-40 hover:bg-transparent'
                : isScreenSharing
                  ? iconBtnActive
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
              <MonitorOff className="h-5 w-5 sm:h-6 sm:w-6" />
            ) : (
              <MonitorUp className="h-5 w-5 sm:h-6 sm:w-6" />
            )}
          </button>

          <button
            onClick={onToggleAddPeople}
            className={`${iconBtn} ${showAddPeople ? iconBtnActive : ''}`}
            title="Add people to call"
            aria-label="Add people to call"
          >
            <UserPlus className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>

          <button
            onClick={onToggleMessageInput}
            className={`${iconBtn} ${showMessageInput ? iconBtnActive : ''}`}
            title="Meeting chat"
            aria-label={showMessageInput ? 'Hide meeting chat' : 'Show meeting chat'}
            aria-pressed={showMessageInput}
          >
            <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>

          {isGroupCall && onToggleHand ? (
            <button
              onClick={onToggleHand}
              className={`${iconBtn} ${handRaised ? 'bg-primary/20 text-primary hover:bg-primary/25 hover:text-primary' : ''}`}
              title={handRaised ? 'Lower hand' : 'Raise hand'}
              aria-label={handRaised ? 'Lower hand' : 'Raise hand'}
              aria-pressed={handRaised}
            >
              <Hand className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          ) : null}

          <button
            onClick={onToggleSpeaker}
            className={iconBtn}
            title={
              speakerLevel === 'normal'
                ? 'Speaker: normal'
                : speakerLevel === 'loud'
                  ? 'Speaker: loud'
                  : 'Speaker: low'
            }
            aria-label={`Speaker ${speakerLevel}`}
          >
            {speakerLevel === 'low' ? (
              <Volume1 className="h-5 w-5 sm:h-6 sm:w-6" />
            ) : (
              <Volume2 className="h-5 w-5 sm:h-6 sm:w-6" />
            )}
          </button>
          <button
            onClick={onEndCall}
            className="flex h-10 w-12 shrink-0 items-center justify-center rounded-full bg-danger text-content-inverse transition hover:opacity-90 focus:outline-none touch-manipulation sm:h-12 sm:w-[4.5rem]"
            title={endCallLabel}
            aria-label={endCallLabel}
          >
            <Phone className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        </div>

        {networkIndicator ? (
          <div className={`${glassCluster} order-2 h-10 w-10 justify-center px-0 sm:order-3 sm:h-12 sm:w-12 sm:justify-self-end`}>
            {networkIndicator}
          </div>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
};

export default CallControls;
