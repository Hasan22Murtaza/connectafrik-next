/**
 * Call entry surface — orchestrates pre-call (token, ringtone) and in-call (provider runtime).
 *
 * Lives at the feature root (not in context/core/providers) because it is the top-level UI
 * shell that wraps provider SDKs (MeetingProvider / LiveKitRoom) before handing off to
 * providers/videosdk or providers/livekit MeetingContainer.
 *
 * Flow:
 *   app/call/[roomId] → CallModal → LiveKitRoom | MeetingProvider → MeetingContainer
 */
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MeetingProvider } from '@videosdk.live/react-sdk';
import { supabase } from '@/lib/supabase';
import { stopAll as stopAllRingtones, playRingtone } from '@/features/video/services/ringtoneService';
import { patchCallSessionWithRetry } from '@/features/chat/services/callSessionRealtime';
import { useAuth } from '@/contexts/AuthContext';
import { getSessionIdFromAccessToken } from '@/shared/utils/sessionDeviceLabel';
import { inferMeetingMaxResolution } from '@/features/video/services/adaptiveCallQuality';
import type { CallModalProps } from '@/features/video/core/types';
import CallStatusOverlay from '@/features/video/ui/CallStatusOverlay';
import IncomingCallControls from '@/features/video/ui/IncomingCallControls';
import VideoSDKMeetingContainer from '@/features/video/providers/videosdk/MeetingContainer';
import LiveKitMeetingContainer from '@/features/video/providers/livekit/MeetingContainer';
import { LiveKitRoom } from '@livekit/components-react';
import { parseCallMediaResponse, resolveLiveKitWsUrl } from '@/lib/call-media/bootstrap';
import type { CallMediaProviderName } from '@/lib/call-media/types';
import { resolveClientVideoProvider } from '@/features/video/core/config';
import { useIncomingCallTerminalSignals } from '@/features/video/hooks/useIncomingCallTerminalSignals';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function safeDecode(str: string | undefined): string {
  if (!str) return 'Unknown';
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const CallModal: React.FC<CallModalProps> = (props) => {
  const { session } = useAuth();
  const {
    isOpen,
    onClose,
    callType,
    callerName,
    recipientName,
    callerAvatarUrl,
    recipientAvatarUrl,
    isIncoming = false,
    onAccept,
    onReject,
    onCallEnd,
    threadId,
    currentUserId,
    roomIdHint,
    tokenHint,
    callIdHint,
    mediaProviderHint,
    wsUrlHint,
  } = props;

  // ── Display props (hydrated on `/call/...` from call-sessions + thread API) ─
  const decodedCallerName = safeDecode(callerName);
  const decodedRecipientName = safeDecode(recipientName);
  const decodedCallerAvatarUrl = callerAvatarUrl ? safeDecode(callerAvatarUrl) : '';
  const decodedRecipientAvatarUrl = recipientAvatarUrl ? safeDecode(recipientAvatarUrl) : '';

  // ── Pre-call state ──────────────────────────────────────────────────────────
  const [token, setToken] = useState<string | null>(null);
  /** Same as Supabase `profiles.id` / `call_sessions.participants` — VideoSDK `participantId`. */
  const [sdkParticipantUserId, setSdkParticipantUserId] = useState<string | null>(null);
  const [meetingId, setMeetingId] = useState<string | null>(
    roomIdHint ?? null,
  );
  const [prePhase, setPrePhase] = useState<'connecting' | 'ringing' | 'error'>(
    'connecting',
  );
  const defaultMediaProvider = resolveClientVideoProvider();
  const [mediaProvider, setMediaProvider] = useState<CallMediaProviderName>(
    mediaProviderHint ?? defaultMediaProvider,
  );
  const [wsUrl, setWsUrl] = useState<string | undefined>(wsUrlHint);
  const [errorMsg, setErrorMsg] = useState('');
  const [isAcceptingCall, setIsAcceptingCall] = useState(false);

  const isMountedRef = useRef(true);
  const hasInitRef = useRef(false);
  const ringtoneRef = useRef<{ stop: () => void } | null>(null);
  const callTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setSdkParticipantUserId(null);
      setMediaProvider(mediaProviderHint ?? defaultMediaProvider);
      setWsUrl(wsUrlHint);
      hasInitRef.current = false;
    }
  }, [isOpen, mediaProviderHint, wsUrlHint, defaultMediaProvider]);

  const applyMediaHints = useCallback(
    (provider: CallMediaProviderName, explicitWsUrl?: string) => {
      setMediaProvider(provider);
      if (provider === 'livekit') {
        setWsUrl(explicitWsUrl ?? resolveLiveKitWsUrl(wsUrlHint));
      }
    },
    [wsUrlHint],
  );

  // ── Token fetcher ───────────────────────────────────────────────────────────
  // Resolve userId from Supabase session here (not only from props). The call popup
  // often mounts before AuthContext hydrates `user?.id`, and JSON.stringify drops
  // `undefined` userId — the API then returns 400 "Missing roomId or userId".
  const getToken = useCallback(
    async (
      rid: string,
    ): Promise<{
      token: string;
      userId: string;
      provider: CallMediaProviderName;
      wsUrl?: string;
    }> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      const resolvedUserId =
        (currentUserId && String(currentUserId).trim()) ||
        session?.user?.id ||
        '';
      if (!resolvedUserId) {
        throw new Error('You must be signed in to start a call.');
      }

      const res = await fetch('/api/videosdk/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({ roomId: rid, userId: resolvedUserId }),
      });

      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        const apiErr =
          typeof payload?.error === 'string' ? payload.error : null;
        throw new Error(apiErr || 'Failed to get VideoSDK token');
      }

      const media = parseCallMediaResponse(payload as Record<string, unknown>);
      if (!media.token) {
        throw new Error('Invalid token response');
      }
      return {
        token: media.token,
        userId: resolvedUserId,
        provider: media.provider,
        wsUrl: media.wsUrl,
      };
    },
    [currentUserId],
  );

  // ── Ringtone helpers ────────────────────────────────────────────────────────
  const stopRingtone = useCallback(() => {
    if (ringtoneRef.current) {
      ringtoneRef.current.stop();
      ringtoneRef.current = null;
    }
    stopAllRingtones();
  }, []);

  // ── Outgoing call: prefer token+room from parent (saves a round-trip); else fetch ─
  useEffect(() => {
    if (!isOpen || isIncoming) return;

    const hint = (tokenHint || '').trim();
    const ridFromHint = (roomIdHint || '').trim();

    if (hint && ridFromHint) {
      let cancelled = false;
      (async () => {
        try {
          setPrePhase('connecting');
          const { data: sessionData } = await supabase.auth.getSession();
          if (cancelled || !isMountedRef.current) return;
          const uid =
            (currentUserId && String(currentUserId).trim()) ||
            sessionData.session?.user?.id ||
            '';
          if (!uid) return;
          if (hasInitRef.current) return;
          hasInitRef.current = true;
          setSdkParticipantUserId(uid);
          setMeetingId(ridFromHint);
          setToken(hint);
          applyMediaHints(mediaProviderHint ?? defaultMediaProvider, wsUrlHint);
        } catch (err: any) {
          if (!isMountedRef.current || cancelled) return;
          hasInitRef.current = false;
          setPrePhase('error');
          setErrorMsg(err?.message || 'Failed to connect');
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    if (hasInitRef.current) return;
    hasInitRef.current = true;

    const init = async () => {
      try {
        setPrePhase('connecting');
        let rid = roomIdHint;
        if (!rid) {
          const { data: { session } } = await supabase.auth.getSession();
          const res = await fetch('/api/videosdk/room', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(session?.access_token
                ? { Authorization: `Bearer ${session.access_token}` }
                : {}),
            },
            body: JSON.stringify({ include_participant_token: true }),
          });
          if (!res.ok) throw new Error('Failed to create call room');
          const data = await res.json();
          rid = data.roomId as string | undefined;
          if (!rid) throw new Error('No room ID returned');
          const preTok = typeof data.token === 'string' ? data.token : '';
          if (preTok) {
            const { data: s2 } = await supabase.auth.getSession();
            const uid =
              (currentUserId && String(currentUserId).trim()) ||
              s2.session?.user?.id ||
              '';
            if (!uid) throw new Error('You must be signed in to start a call.');
            if (!isMountedRef.current) return;
            const media = parseCallMediaResponse(data as Record<string, unknown>);
            setSdkParticipantUserId(uid);
            setMeetingId(rid);
            setToken(preTok);
            applyMediaHints(media.provider, media.wsUrl);
            return;
          }
        }
        const { token: tok, userId: joinUid, provider, wsUrl: resolvedWsUrl } = await getToken(rid);
        if (!isMountedRef.current) return;
        setSdkParticipantUserId(joinUid);
        setMeetingId(rid);
        setToken(tok);
        applyMediaHints(provider, resolvedWsUrl);
      } catch (err: any) {
        if (!isMountedRef.current) return;
        // Allow retry when `currentUserId` hydrates after first paint or user refreshes.
        hasInitRef.current = false;
        setPrePhase('error');
        setErrorMsg(err.message || 'Failed to connect');
      }
    };

    init();
  }, [isOpen, isIncoming, roomIdHint, tokenHint, mediaProviderHint, wsUrlHint, getToken, currentUserId, applyMediaHints]);

  // ── Incoming ring: PATCH uses accept | declined | end | missed (no legacy reject)
  const signalIncomingTerminal = useCallback(
    async (event: 'declined' | 'missed') => {
      stopRingtone();
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      const activeCallId = callIdHint || '';
      if (threadId && activeCallId) {
        const sid =
          event === 'declined'
            ? getSessionIdFromAccessToken(session?.access_token ?? null)
            : null;
        await patchCallSessionWithRetry(threadId, {
          call_id: activeCallId,
          event,
          ...(sid ? { device_session_id: sid } : {}),
        });
      }
      onReject?.();
      setTimeout(() => onClose(), 500);
    },
    [stopRingtone, callIdHint, threadId, onReject, onClose, session?.access_token],
  );

  const handleReject = useCallback(() => {
    void signalIncomingTerminal('declined');
  }, [signalIncomingTerminal]);

  const handleIncomingNoAnswer = useCallback(() => {
    void signalIncomingTerminal('missed');
  }, [signalIncomingTerminal]);

  // Remote terminal while still ringing (caller cancelled, missed, etc.)
  useIncomingCallTerminalSignals({
    enabled: isOpen && isIncoming && !token,
    threadId,
    callId: callIdHint,
    currentUserId,
    onTerminal: () => {
      stopRingtone();
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      onClose();
    },
  });

  // ── Incoming call: ring immediately; token is fetched only on Accept ────────
  // `token` must be in deps: otherwise when callbacks re-create (auth/hydration),
  // this effect re-runs and starts the ringtone again after Accept.
  useEffect(() => {
    if (!isOpen || !isIncoming || token) return;
    setPrePhase('ringing');
    if (roomIdHint) setMeetingId(roomIdHint);

    playRingtone().then((r) => {
      if (isMountedRef.current) ringtoneRef.current = r;
    });

    callTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) handleIncomingNoAnswer();
    }, 45_000);

    return () => {
      stopRingtone();
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
    };
  }, [isOpen, isIncoming, token, roomIdHint, stopRingtone, handleIncomingNoAnswer]);

  // ── Accept handler (incoming ring phase) — fetches token then shows meeting ─
  const handleAccept = useCallback(async () => {
    if (isAcceptingCall || !meetingId) return;
    setIsAcceptingCall(true);
    stopRingtone();
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    // Immediately tell the parent window to stop the incoming ringtone.
    // We do this here (not inside onMeetingJoined) so the ringtone stops the
    // moment the receiver taps Accept, even before VideoSDK finishes joining.
    if (typeof window !== 'undefined' && threadId) {
      const cid = (callIdHint || '').trim();
      const payload = {
        type: 'CALL_STATUS',
        status: 'active',
        threadId,
        ...(cid ? { callId: cid } : {}),
      };
      try { window.postMessage(payload, window.location.origin); } catch { /* ignore */ }
      try { if (window.opener && !window.opener.closed) window.opener.postMessage(payload, window.location.origin); } catch { /* ignore */ }
      try {
        if (window.parent !== window && !window.parent.closed) {
          window.parent.postMessage(payload, window.location.origin);
        }
      } catch { /* ignore */ }
    }
    try {
      const { token: tok, userId: joinUid, provider, wsUrl: resolvedWsUrl } = await getToken(meetingId);
      if (!isMountedRef.current) return;
      setSdkParticipantUserId(joinUid);
      setToken(tok);
      applyMediaHints(provider, resolvedWsUrl);
    } catch (err: any) {
      if (!isMountedRef.current) return;
      setIsAcceptingCall(false);
      setPrePhase('error');
      setErrorMsg(err.message || 'Failed to connect');
    }
  }, [isAcceptingCall, meetingId, threadId, callIdHint, getToken, stopRingtone, applyMediaHints]);

  // ── Early return: modal is closed ──────────────────────────────────────────
  if (!isOpen) return null;

  // ── Pre-call: incoming — ringing screen ────────────────────────────────────
  if (isIncoming && !token) {
    return (
      <div
        className="fixed inset-0 z-[9999] animate-fadeIn bg-surface-canvas"
      >
        <CallStatusOverlay
          callStatus="ringing"
          callType={callType}
          callDuration={0}
          formatDuration={() => '00:00'}
          isIncoming
          decodedCallerName={decodedCallerName}
          decodedRecipientName={decodedRecipientName}
          decodedCallerAvatarUrl={decodedCallerAvatarUrl}
          decodedRecipientAvatarUrl={decodedRecipientAvatarUrl}
          isScreenSharing={false}
          remoteScreenShareStream={null}
        />
        <IncomingCallControls
          isAcceptingCall={isAcceptingCall}
          onAccept={handleAccept}
          onReject={handleReject}
        />
      </div>
    );
  }

  // ── Pre-call: outgoing — connecting / error screen ─────────────────────────
  if (!token || !meetingId) {
    return (
      <div
        className="fixed inset-0 z-[9999] bg-surface-canvas"
      >
        {prePhase === 'error' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-content p-8 text-center">
            <div className="text-lg font-semibold">Connection Failed</div>
            <div className="text-sm text-content-secondary">{errorMsg}</div>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-red-500 text-white rounded-full text-sm font-medium hover:bg-red-600 transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <CallStatusOverlay
            callStatus="connecting"
            callType={callType}
            callDuration={0}
            formatDuration={() => '00:00'}
            isIncoming={false}
            decodedCallerName={decodedCallerName}
            decodedRecipientName={decodedRecipientName}
            decodedCallerAvatarUrl={decodedCallerAvatarUrl}
            decodedRecipientAvatarUrl={decodedRecipientAvatarUrl}
            isScreenSharing={false}
            remoteScreenShareStream={null}
          />
        )}
      </div>
    );
  }

  // ── In-call: LiveKit or VideoSDK depending on resolved media provider ───────
  /** Local participant display name for VideoSDK: callee uses recipient*, caller uses caller*. */
  const localDisplayName = isIncoming
    ? decodedRecipientName && decodedRecipientName !== 'Unknown'
      ? decodedRecipientName
      : 'User'
    : decodedCallerName && decodedCallerName !== 'Unknown'
      ? decodedCallerName
      : 'User';

  const localAvatarForSdk = (
    isIncoming ? decodedRecipientAvatarUrl : decodedCallerAvatarUrl
  ).trim();

  /** VideoSDK optional join payload: must be a plain object when provided (e.g. profile image URL). */
  const meetingMetaData: Record<string, string> =
    localAvatarForSdk.length > 0 ? { profileImage: localAvatarForSdk } : {};

  const inCallShellProps = {
    isOpen,
    onClose,
    callType,
    isIncoming,
    onAccept,
    onCallEnd,
    threadId,
    currentUserId,
    roomIdHint,
    callIdHint,
    meetingId,
    resolvedCallerName: localDisplayName,
    decodedCallerName,
    decodedRecipientName,
    decodedCallerAvatarUrl,
    decodedRecipientAvatarUrl,
  };

  if (mediaProvider === 'livekit') {
    const serverUrl = resolveLiveKitWsUrl(wsUrl);
    if (!serverUrl) {
      return (
        <div className="fixed inset-0 z-[9999] bg-surface-canvas">
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-content p-8 text-center">
            <div className="text-lg font-semibold">Connection Failed</div>
            <div className="text-sm text-content-secondary">
              LiveKit server URL is not configured. Set NEXT_PUBLIC_LIVEKIT_WS_URL.
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-red-500 text-white rounded-full text-sm font-medium hover:bg-red-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 z-[9999] animate-fadeIn">
        <LiveKitRoom
          serverUrl={serverUrl}
          token={token}
          connect={true}
          audio={true}
          video={callType === 'video'}
          onError={(err) => {
            console.error('[LiveKitRoom] error:', err);
            if (isMountedRef.current) {
              setPrePhase('error');
              setErrorMsg(err?.message || 'Failed to connect to call');
            }
          }}
        >
          <LiveKitMeetingContainer {...inCallShellProps} />
        </LiveKitRoom>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] animate-fadeIn">
      <MeetingProvider
        config={{
          meetingId,
          micEnabled: true,
          webcamEnabled: callType === 'video',
          name: localDisplayName,
          metaData: meetingMetaData,
          ...(sdkParticipantUserId ? { participantId: sdkParticipantUserId } : {}),
          mode: 'SEND_AND_RECV' as const,
          multiStream: false,
          debugMode: false,
          maxResolution:
            callType === 'video' ? inferMeetingMaxResolution() : undefined,
        }}
        token={token}
        joinWithoutUserInteraction
      >
        <VideoSDKMeetingContainer {...inCallShellProps} />
      </MeetingProvider>
    </div>
  );
};

export { CallModal, CallModal as VideoSDKCallModal };
export type { CallModalProps };
export default CallModal;
