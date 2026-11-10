import {
  Hand,
  MessageSquare,
  Mic,
  MicOff,
  MonitorOff,
  MonitorUp,
  MoreHorizontal,
  Phone,
  Smile,
  Video,
  VideoOff,
  Users,
  Settings,
} from '@/shared/icons';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CALL_LIVE_REACTIONS } from '@/features/video/core/callEngagement';

interface CallControlsProps {
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  remoteScreenShareStream: MediaStream | null;
  screenShareParticipantName: string;
  callType: 'audio' | 'video';
  showMessageInput: boolean;
  showParticipants?: boolean;
  showSettings?: boolean;
  isGroupCall?: boolean;
  handRaised?: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleMessageInput: () => void;
  onToggleParticipants?: () => void;
  onToggleSettings?: () => void;
  onToggleHand?: () => void;
  onSendReaction?: (emoji: string) => void;
  onEndCall: () => void;
  onEndCallForAll?: () => void;
}

const iconBtn =
  'call-toolbar-button flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-content-secondary transition hover:bg-surface-hover hover:text-content focus:outline-none touch-manipulation sm:h-12 sm:w-12';
const iconBtnActive = 'bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary';

type AnchorBox = { left: number; bottom: number; width: number };

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
  const endCallLabel = isGroupCall ? 'Leave call' : 'End call';
  const screenShareTitle = screenShareDisabled
    ? `${screenShareParticipantName} is already presenting`
    : isScreenSharing
      ? 'Stop sharing'
      : 'Share screen';

  const [reactionOpen, setReactionOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [anchor, setAnchor] = useState<AnchorBox | null>(null);

  const shellRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const closeMenus = () => {
    setReactionOpen(false);
    setMoreOpen(false);
  };

  const measureAnchor = () => {
    const el = shellRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      left: rect.left + rect.width / 2,
      bottom: Math.max(8, window.innerHeight - rect.top + 10),
      width: rect.width,
    };
  };

  useLayoutEffect(() => {
    if (!reactionOpen && !moreOpen) {
      setAnchor(null);
      return;
    }
    setAnchor(measureAnchor());
    const onReposition = () => setAnchor(measureAnchor());
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [reactionOpen, moreOpen]);

  useEffect(() => {
    if (!reactionOpen && !moreOpen) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (shellRef.current?.contains(target)) return;
      if (popupRef.current?.contains(target)) return;
      closeMenus();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenus();
    };

    const timer = window.setTimeout(() => {
      document.addEventListener('mousedown', onPointerDown);
      document.addEventListener('touchstart', onPointerDown);
    }, 0);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [reactionOpen, moreOpen]);

  const renderMute = (key: string) => (
    <button
      key={key}
      type="button"
      onClick={onToggleMute}
      className={`${iconBtn} ${isMuted ? 'call-toolbar-button-danger' : 'call-toolbar-button-on'}`}
      title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
      aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
      aria-pressed={!isMuted}
    >
      {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
    </button>
  );

  const renderVideo = (key: string) => (
    <button
      key={key}
      type="button"
      onClick={onToggleVideo}
      className={`${iconBtn} ${cameraOn ? 'call-toolbar-button-on' : 'call-toolbar-button-danger'}`}
      title={videoButtonTitle}
      aria-label={videoButtonTitle}
      aria-pressed={cameraOn}
    >
      {cameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
    </button>
  );

  const renderEndCall = (key: string) => (
    <button
      key={key}
      type="button"
      onClick={onEndCall}
      className="call-toolbar-leave"
      title={endCallLabel}
      aria-label={endCallLabel}
    >
      <Phone className="h-5 w-5" />
      <span>{endCallLabel}</span>
    </button>
  );

  const renderScreenShare = (key: string) => (
    <button
      key={key}
      type="button"
      onClick={() => {
        onToggleScreenShare();
        setMoreOpen(false);
      }}
      disabled={screenShareDisabled}
      className={`${iconBtn} ${
        screenShareDisabled
          ? 'cursor-not-allowed opacity-40 hover:bg-transparent'
          : isScreenSharing
            ? iconBtnActive
            : ''
      }`}
      title={screenShareTitle}
      aria-label={
        screenShareDisabled
          ? 'Screen share unavailable - someone is presenting'
          : isScreenSharing
            ? 'Stop sharing screen'
            : 'Share screen'
      }
      aria-pressed={isScreenSharing}
    >
      {isScreenSharing ? <MonitorOff className="h-5 w-5" /> : <MonitorUp className="h-5 w-5" />}
    </button>
  );

  const renderReaction = (key: string) =>
    onSendReaction ? (
      <button
        key={key}
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setMoreOpen(false);
          setReactionOpen((open) => !open);
        }}
        className={`${iconBtn} ${reactionOpen ? iconBtnActive : ''}`}
        title="Send a reaction"
        aria-label="Send a reaction"
        aria-expanded={reactionOpen}
        aria-haspopup="menu"
      >
        <Smile className="h-5 w-5" />
      </button>
    ) : null;

  const renderHand = (key: string) =>
    isGroupCall && onToggleHand ? (
      <button
        key={key}
        type="button"
        onClick={() => {
          onToggleHand();
          setMoreOpen(false);
        }}
        className={`${iconBtn} ${handRaised ? 'bg-primary/20 text-primary hover:bg-primary/25 hover:text-primary' : ''}`}
        title={handRaised ? 'Lower hand' : 'Raise hand'}
        aria-label={handRaised ? 'Lower hand' : 'Raise hand'}
        aria-pressed={handRaised}
      >
        <Hand className="h-5 w-5" />
      </button>
    ) : null;

  const renderParticipants = (key: string) =>
    onToggleParticipants ? (
      <button
        key={key}
        type="button"
        onClick={() => {
          onToggleParticipants();
          closeMenus();
        }}
        className={`${iconBtn} ${showParticipants ? iconBtnActive : ''}`}
        title="Participants"
        aria-label="Show participants"
        aria-pressed={showParticipants}
        aria-expanded={showParticipants}
        aria-controls="call-people-panel"
      >
        <Users className="h-5 w-5" />
      </button>
    ) : null;

  const renderChat = (key: string) => (
    <button
      key={key}
      type="button"
      onClick={() => {
        onToggleMessageInput();
        closeMenus();
      }}
      className={`${iconBtn} ${showMessageInput ? iconBtnActive : ''}`}
      title="Meeting chat"
      aria-label={showMessageInput ? 'Hide meeting chat' : 'Show meeting chat'}
      aria-pressed={showMessageInput}
    >
      <MessageSquare className="h-5 w-5" />
    </button>
  );

  const renderSettings = (key: string) =>
    onToggleSettings ? (
      <button
        key={key}
        type="button"
        onClick={() => {
          onToggleSettings();
          closeMenus();
        }}
        className={`${iconBtn} ${showSettings ? iconBtnActive : ''}`}
        title="Call settings"
        aria-label="Call settings"
        aria-pressed={showSettings}
        aria-expanded={showSettings}
        aria-controls="call-settings-panel"
      >
        <Settings className="h-5 w-5" />
      </button>
    ) : null;

  const moreMenuActive =
    showParticipants || showMessageInput || showSettings || isScreenSharing || handRaised || reactionOpen;

  const portalMenus =
    mounted &&
    anchor &&
    (reactionOpen || moreOpen) &&
    createPortal(
      <div
        ref={popupRef}
        className="call-floating-menus"
        style={{
          position: 'fixed',
          left: anchor.left,
          bottom: anchor.bottom,
          transform: 'translateX(-50%)',
          zIndex: 2147483000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          pointerEvents: 'auto',
        }}
      >
        {reactionOpen && onSendReaction ? (
          <div className="call-reaction-picker call-reaction-picker--portal" role="menu" aria-label="Live reactions">
            {CALL_LIVE_REACTIONS.map((reaction) => (
              <button
                key={reaction.emoji}
                type="button"
                role="menuitem"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onSendReaction(reaction.emoji);
                  closeMenus();
                }}
                className="call-reaction-picker-item noto-color-emoji-regular"
                title={reaction.label}
                aria-label={reaction.label}
              >
                {reaction.emoji}
              </button>
            ))}
          </div>
        ) : null}

        {moreOpen ? (
          <div className="call-more-menu-row call-more-menu-row--portal" role="menu" aria-label="More call actions">
            {renderScreenShare('more-share')}
            {renderReaction('more-reaction')}
            {renderHand('more-hand')}
            {renderParticipants('more-people')}
            {renderChat('more-chat')}
            {renderSettings('more-settings')}
          </div>
        ) : null}
      </div>,
      document.body,
    );

  return (
    <div className="call-controls pointer-events-none fixed inset-x-0 bottom-0 z-[60] w-full overflow-visible pt-2.5">
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

      <div className="call-toolbar-wrap pointer-events-auto relative z-[1] flex w-full justify-center overflow-visible px-2 pb-[max(0.85rem,env(safe-area-inset-bottom,0px))]">
        <div className="call-toolbar-shell relative flex flex-col items-center overflow-visible" ref={shellRef}>
          <div className="call-toolbar call-toolbar-desktop-only hidden max-w-[calc(100vw-24px)] items-center gap-0.5 overflow-visible rounded-full border border-[color:var(--call-border)] bg-[color-mix(in_srgb,var(--call-panel)_94%,transparent)] px-2 py-1.5 shadow-[0_12px_40px_rgb(0_0_0/18%)] backdrop-blur-xl max-[720px]:!hidden min-[721px]:flex">
            {renderMute('desk-mute')}
            {renderVideo('desk-video')}
            <span className="call-toolbar-separator" aria-hidden="true" />
            {renderScreenShare('desk-share')}
            {renderReaction('desk-reaction')}
            {renderHand('desk-hand')}
            <span className="call-toolbar-separator" aria-hidden="true" />
            {renderParticipants('desk-people')}
            {renderChat('desk-chat')}
            {renderSettings('desk-settings')}
            {renderEndCall('desk-end')}
          </div>

          <div className="call-toolbar call-toolbar-mobile-only flex max-w-[calc(100vw-24px)] items-center gap-0.5 overflow-visible rounded-full border border-[color:var(--call-border)] bg-[color-mix(in_srgb,var(--call-panel)_94%,transparent)] px-1.5 py-1 shadow-[0_12px_40px_rgb(0_0_0/18%)] backdrop-blur-xl max-[720px]:!flex min-[721px]:!hidden">
            {renderMute('mob-mute')}
            {renderVideo('mob-video')}
            <span className="call-toolbar-separator" aria-hidden="true" />
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setReactionOpen(false);
                setMoreOpen((open) => !open);
              }}
              className={`${iconBtn} ${moreOpen || moreMenuActive ? iconBtnActive : ''}`}
              title="More actions"
              aria-label="More call actions"
              aria-expanded={moreOpen}
              aria-haspopup="menu"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
            {renderEndCall('mob-end')}
          </div>
        </div>
      </div>
      {portalMenus}
    </div>
  );
};

export default CallControls;
