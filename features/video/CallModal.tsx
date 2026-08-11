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
import toast from 'react-hot-toast';
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
import type { Room } from 'livekit-client';
import { parseCallMediaResponse, resolveLiveKitWsUrl } from '@/lib/call-media/bootstrap';
import type { CallMediaProviderName } from '@/lib/call-media/types';
import { resolveClientVideoProvider } from '@/features/video/core/config';
import { useIncomingCallTerminalSignals } from '@/features/video/hooks/useIncomingCallTerminalSignals';
import {
  CALL_AUDIO_CAPTURE,
  connectLiveKitWithPreparedAudio,
} from '@/features/video/providers/livekit/prepareCallAudio';

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

  /** Local participant's own name/avatar: callee uses recipient*, caller uses caller*.
   *  Computed here (not just at render time) so getToken() can stamp them onto
   *  the LiveKit participant at token-mint time — without this, LiveKit's
   *  AccessToken has no name/avatar to fall back to except the raw user id. */
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
  const [livekitRoom, setLivekitRoom] = useState<Room | null>(null);
  const [livekitPrepError, setLivekitPrepError] = useState('');

  const isMountedRef = useRef(true);
  const hasInitRef = useRef(false);
  const ringtoneRef = useRef<{ stop: () => void } | null>(null);
  const callTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Token round-trip started WHILE ringing so Accept has nothing left to await. */
  const prewarmRef = useRef<Promise<{
    token: string;
    userId: string;
    provider: CallMediaProviderName;
    wsUrl?: string;
  }> | null>(null);
  const prewarmStreamRef = useRef<MediaStream | null>(null);
  const livekitPrepGenRef = useRef(0);

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
      livekitPrepGenRef.current += 1;
      setLivekitRoom(null);
      setLivekitPrepError('');
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
  // Identity is derived server-side from the Authorization bearer; do not send
  // userId / displayName / avatarUrl — the token route ignores them.
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
      if (!session?.access_token) {
        throw new Error('You must be signed in to start a call.');
      }

      const res = await fetch('/api/videosdk/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        // `mediaProviderHint` here is only ever set from a server-confirmed
        // source (the outgoing bootstrap, or the call session's stored
        // metadata.provider for incoming) -- never the client's own default
        // guess -- so pinning to it is safe. Prevents this token request from
        // re-resolving to a different provider than the one the room actually
        // exists on.
        body: JSON.stringify({
          roomId: rid,
          ...(mediaProviderHint ? { provider: mediaProviderHint } : {}),
        }),
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
      const responseUserId =
        typeof (payload as { userId?: unknown }).userId === 'string'
          ? String((payload as { userId: string }).userId).trim()
          : '';
      const fallbackUserId =
        (currentUserId && String(currentUserId).trim()) || session.user?.id || '';
      const resolvedUserId = responseUserId || fallbackUserId;
      if (!resolvedUserId) {
        throw new Error('You must be signed in to start a call.');
      }
      return {
        token: media.token,
        userId: resolvedUserId,
        provider: media.provider,
        wsUrl: media.wsUrl,
      };
    },
    [currentUserId, mediaProviderHint],
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
            body: JSON.stringify({
              include_participant_token: true,
              ...(localDisplayName ? { display_name: localDisplayName } : {}),
              ...(localAvatarForSdk ? { avatar_url: localAvatarForSdk } : {}),
            }),
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
  }, [
    isOpen,
    isIncoming,
    roomIdHint,
    tokenHint,
    mediaProviderHint,
    wsUrlHint,
    getToken,
    currentUserId,
    applyMediaHints,
    localDisplayName,
    localAvatarForSdk,
  ]);

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

  // ── Prewarm: do the join round-trip WHILE the phone is still ringing ───────
  // Ringing is 5-15s of otherwise idle time. Moving the token fetch (and its
  // getSession() round-trip) off the critical path after Accept is the bulk of
  // the "receiver has to say hello three times" connect-latency complaint —
  // the outgoing path already does the equivalent (tokenHint/roomIdHint from
  // the caller's own bootstrap), this closes the gap for the callee.
  useEffect(() => {
    if (!isOpen || !isIncoming || token || !meetingId) return;
    if (prewarmRef.current) return;
    const pending = getToken(meetingId);
    pending.catch(() => {}); // handleAccept re-awaits and handles the real error
    prewarmRef.current = pending;
    return () => {
      // Ring ended without Accept (declined/missed/closed) — drop it so a stale
      // token from a prior ring is never reused for a later Accept.
      prewarmRef.current = null;
    };
  }, [isOpen, isIncoming, token, meetingId, getToken]);

  // Acquire the microphone during ringing too — otherwise device wake-up (and
  // on mobile, possibly a permission prompt) is serialized AFTER the token
  // fetch inside handleAccept instead of overlapping it.
  useEffect(() => {
    if (!isOpen || !isIncoming || token) return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ audio: CALL_AUDIO_CAPTURE })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        prewarmStreamRef.current = stream;
      })
      .catch(() => {
        // Denied or unavailable — the SDK will surface it normally on join.
      });
    return () => {
      cancelled = true;
      prewarmStreamRef.current?.getTracks().forEach((t) => t.stop());
      prewarmStreamRef.current = null;
    };
  }, [isOpen, isIncoming, token]);

  useEffect(() => {
    if (!isOpen || !token || mediaProvider !== 'livekit') return;
    const serverUrl = resolveLiveKitWsUrl(wsUrl);
    if (!serverUrl) {
      setLivekitPrepError(
        'LiveKit server URL is not configured. Set NEXT_PUBLIC_LIVEKIT_WS_URL.',
      );
      return;
    }

    const gen = ++livekitPrepGenRef.current;
    let cancelled = false;
    setLivekitPrepError('');
    setLivekitRoom(null);

    (async () => {
      try {
        const { room } = await connectLiveKitWithPreparedAudio({
          serverUrl,
          token,
          video: callType === 'video',
        });
        if (cancelled || gen !== livekitPrepGenRef.current || !isMountedRef.current) {
          await room.disconnect().catch(() => undefined);
          return;
        }
        setLivekitRoom(room);
      } catch (err: unknown) {
        if (cancelled || gen !== livekitPrepGenRef.current || !isMountedRef.current) return;
        const message = err instanceof Error ? err.message : 'Failed to connect';
        setLivekitPrepError(message);
        setPrePhase('error');
        setErrorMsg(message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, token, mediaProvider, wsUrl, callType]);

  // ── Accept handler (incoming ring phase) — fetches token then shows meeting ─
  const handleAccept = useCallback(async () => {
    if (isAcceptingCall || !meetingId) return;
    setIsAcceptingCall(true);
    stopRingtone();
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    // The prewarmed mic stream was only to front-load the permission prompt /
    // hardware wake-up; the SDK acquires its own track on join, so release it.
    prewarmStreamRef.current?.getTracks().forEach((t) => t.stop());
    prewarmStreamRef.current = null;
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
      let resolved: { token: string; userId: string; provider: CallMediaProviderName; wsUrl?: string };
      try {
        // Usually already settled by the time the user taps Accept -> ~0ms.
        resolved = prewarmRef.current ? await prewarmRef.current : await getToken(meetingId);
      } catch {
        // Prewarm failed (e.g. session refreshed mid-ring) — retry inline so a
        // failed optimization can never break Accept itself.
        resolved = await getToken(meetingId);
      }
      if (!isMountedRef.current) return;
      const { token: tok, userId: joinUid, provider, wsUrl: resolvedWsUrl } = resolved;
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
    if (!serverUrl || livekitPrepError) {
      return (
        <div className="fixed inset-0 z-[9999] bg-surface-canvas">
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-content p-8 text-center">
            <div className="text-lg font-semibold">Connection Failed</div>
            <div className="text-sm text-content-secondary">
              {livekitPrepError ||
                'LiveKit server URL is not configured. Set NEXT_PUBLIC_LIVEKIT_WS_URL.'}
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

    if (!livekitRoom) {
      return (
        <div className="fixed inset-0 z-[9999] bg-surface-canvas">
          <CallStatusOverlay
            callStatus="connecting"
            callType={callType}
            callDuration={0}
            formatDuration={() => '00:00'}
            isIncoming={isIncoming}
            decodedCallerName={decodedCallerName}
            decodedRecipientName={decodedRecipientName}
            decodedCallerAvatarUrl={decodedCallerAvatarUrl}
            decodedRecipientAvatarUrl={decodedRecipientAvatarUrl}
            isScreenSharing={false}
            remoteScreenShareStream={null}
          />
        </div>
      );
    }

    return (
      <div className="fixed inset-0 z-[9999] animate-fadeIn">
        <LiveKitRoom
          room={livekitRoom}
          serverUrl={serverUrl}
          token={token}
          connect={true}
          audio={CALL_AUDIO_CAPTURE}
          video={callType === 'video'}
          onError={(err) => {
            console.error('[LiveKitRoom] error:', err);
            // This branch always renders past the `!token || !meetingId` gate
            // (this component only mounts once both are set), so `prePhase`/
            // `errorMsg` are never read again after this point -- setting them
            // here was dead code that looked like error handling but wasn't.
            // LiveKitMeetingContainer's own room-event listeners (Reconnecting/
            // Reconnected/Disconnected) own recovery for the established call;
            // surface this one visibly instead of silently dropping it.
            toast.error(err?.message || 'Call connection issue — trying to recover');
          }}
        >
          <LiveKitMeetingContainer
            {...inCallShellProps}
            livekitServerUrl={serverUrl}
            refreshToken={() =>
              getToken(meetingId).then((r) => ({ token: r.token, wsUrl: r.wsUrl }))
            }
          />
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
