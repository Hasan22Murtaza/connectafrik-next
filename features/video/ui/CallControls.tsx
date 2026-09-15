import {
  Hand,
  MessageSquare,
  Mic,
  MicOff,
  MonitorOff,
  MonitorUp,
  PhoneOff,
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
}

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
  isGroupCall = false,
  handRaised = false,
}) => {
  const screenShareDisabled = !!remoteScreenShareStream && !isScreenSharing;
  const showVideoButton = true;
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
    <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center justify-center pb-2 sm:pb-3 md:pb-6 mb-20 sm:mb-0 px-2 sm:px-3 md:px-4 z-30">
      <div className="space-y-2 sm:space-y-3 md:space-y-4 w-full max-w-2xl">
        <div className="flex justify-center items-center gap-1.5 sm:gap-2 md:gap-3 flex-wrap bg-black/40 backdrop-blur-md rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 md:px-5 md:py-3 shadow-2xl border border-white/10 transition-all duration-300">
          {/* Mute */}
          <button
            onClick={onToggleMute}
            className={`rounded-full p-2.5 sm:p-3 md:p-4 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-110 active:scale-95 focus:outline-none ${
              isMuted
                ? 'bg-red-500 hover:bg-red-600 active:bg-red-700 text-white'
                : 'bg-surface/90 hover:bg-surface text-content focus:ring-gray-400 backdrop-blur-sm'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
            aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? <MicOff className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" /> : <Mic className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />}
          </button>

          {/* Video toggle / upgrade to video */}
          {showVideoButton && (
            <button
              onClick={onToggleVideo}
              className={`rounded-full p-2.5 sm:p-3 md:p-4 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-110 active:scale-95 focus:outline-none ${
                callType === 'video' && isVideoEnabled
                  ? 'bg-surface/90 hover:bg-surface text-content backdrop-blur-sm'
                  : callType === 'audio'
                    ? 'bg-primary-500/90 hover:bg-primary-600 text-white backdrop-blur-sm'
                    : 'bg-red-500 hover:bg-red-600 active:bg-red-700 text-white'
              }`}
              title={videoButtonTitle}
              aria-label={videoButtonTitle}
            >
              {callType === 'video' && isVideoEnabled ? (
                <Video className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
              ) : (
                <VideoOff className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
              )}
            </button>
          )}

          {/* Speaker */}
          <button
            onClick={onToggleSpeaker}
            className="rounded-full p-2.5 sm:p-3 md:p-4 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-110 active:scale-95 focus:outline-none bg-surface/90 hover:bg-surface text-content backdrop-blur-sm"
            title={speakerLevel === 'normal' ? 'Speaker: normal' : speakerLevel === 'loud' ? 'Speaker: loud' : 'Speaker: low'}
            aria-label={`Speaker ${speakerLevel}`}
          >
            {speakerLevel === 'low' ? (
              <Volume1 className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
            ) : (
              <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
            )}
          </button>

          {/* Screen share */}
          <button
            onClick={onToggleScreenShare}
            disabled={screenShareDisabled}
            className={`rounded-full p-2.5 sm:p-3 md:p-4 transition-all duration-200 shadow-md focus:outline-none ${
              screenShareDisabled
                ? 'bg-gray-400/60 text-content-secondary cursor-not-allowed opacity-50'
                : isScreenSharing
                  ? 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white hover:shadow-lg hover:scale-110 active:scale-95'
                  : 'bg-surface/90 hover:bg-surface text-content backdrop-blur-sm hover:shadow-lg hover:scale-110 active:scale-95'
            }`}
            title={screenShareDisabled ? `${screenShareParticipantName} is already presenting` : isScreenSharing ? 'Stop sharing' : 'Share screen'}
            aria-label={screenShareDisabled ? 'Screen share unavailable - someone is presenting' : isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
          >
            {isScreenSharing ? <MonitorOff className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" /> : <MonitorUp className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />}
          </button>

          {/* Message */}
          <button
            onClick={onToggleMessageInput}
            className={`rounded-full p-2.5 sm:p-3 md:p-4 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-110 active:scale-95 focus:outline-none ${
              showMessageInput
                ? 'bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white'
                : 'bg-surface/90 hover:bg-surface text-content backdrop-blur-sm'
            }`}
            title="Meeting chat"
            aria-label={showMessageInput ? 'Hide meeting chat' : 'Show meeting chat'}
            aria-pressed={showMessageInput}
          >
            <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
          </button>

          {isGroupCall && onToggleHand ? (
            <button
              onClick={onToggleHand}
              className={`rounded-full p-2.5 sm:p-3 md:p-4 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-110 active:scale-95 focus:outline-none ${
                handRaised
                  ? 'bg-amber-400 hover:bg-amber-300 text-amber-950'
                  : 'bg-surface/90 hover:bg-surface text-content backdrop-blur-sm'
              }`}
              title={handRaised ? 'Lower hand' : 'Raise hand'}
              aria-label={handRaised ? 'Lower hand' : 'Raise hand'}
              aria-pressed={handRaised}
            >
              <Hand className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
            </button>
          ) : null}

          {onSendReaction ? (
            <div className="relative" ref={reactionWrapRef}>
              <button
                onClick={() => setReactionOpen((open) => !open)}
                className={`rounded-full p-2.5 sm:p-3 md:p-4 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-110 active:scale-95 focus:outline-none ${
                  reactionOpen
                    ? 'bg-primary-500 hover:bg-primary-600 text-white'
                    : 'bg-surface/90 hover:bg-surface text-content backdrop-blur-sm'
                }`}
                title="Send a reaction"
                aria-label="Send a reaction"
                aria-expanded={reactionOpen}
                aria-haspopup="true"
              >
                <Smile className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
              </button>
              {reactionOpen ? (
                <div
                  className="absolute bottom-full left-1/2 z-50 mb-2 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-white/15 bg-black/80 px-1.5 py-1 shadow-2xl backdrop-blur-md"
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
                      className="flex h-9 w-9 items-center justify-center rounded-full text-xl transition hover:bg-white/15 hover:scale-110 active:scale-95 noto-color-emoji-regular"
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

          {/* Add people */}
          <button
            onClick={onToggleAddPeople}
            className={`rounded-full p-2.5 sm:p-3 md:p-4 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-110 active:scale-95 focus:outline-none ${
              showAddPeople
                ? 'bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white'
                : 'bg-surface/90 hover:bg-surface text-content backdrop-blur-sm'
            }`}
            title="Add people to call"
            aria-label="Add people to call"
          >
            <UserPlus className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
          </button>

          {/* End / leave call */}
          <button
            onClick={onEndCall}
            className="bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-full p-2.5 sm:p-3 md:p-4 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 active:scale-95 focus:outline-none"
            title={endCallLabel}
            aria-label={endCallLabel}
          >
            <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
          </button>
        </div>

        {onEndCallForAll && (
          <button
            type="button"
            onClick={onEndCallForAll}
            className="text-xs font-medium text-white/90 hover:text-white underline underline-offset-2 transition"
          >
            End call for everyone
          </button>
        )}
      </div>
    </div>
  );
};

export default CallControls;
