/**
 * VideoSDKCallModal — the outermost call surface component.
 *
 * Split into two clear phases:
 *
 * 1. Pre-call phase (handled here, outside MeetingProvider):
 *    - Outgoing: fetches a VideoSDK token + room ID, shows "Connecting…" spinner.
 *    - Incoming: plays ringtone, shows the ringing screen; fetches token only after
 *      the user taps Accept so the meeting is joined immediately on accept.
 *
 * 2. In-call phase (delegated to MeetingContainer inside MeetingProvider):
 *    - MeetingProvider initialises the VideoSDK React SDK with the resolved token
 *      and meeting ID.
 *    - MeetingContainer owns `useMeeting`, event handling, signaling, and rendering.
 *
 * This separation keeps MeetingProvider unmounted until we have a valid token,
 * which avoids initialisation errors and makes reconnect logic straightforward.
 */
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MeetingProvider } from '@videosdk.live/react-sdk';
import { supabase } from '@/lib/supabase';
import { stopAll as stopAllRingtones, playRingtone } from '@/features/video/services/ringtoneService';
import { patchCallSessionWithRetry } from '@/features/chat/services/callSessionRealtime';
import type { VideoSDKCallModalProps } from './call/types';
import CallStatusOverlay from './call/CallStatusOverlay';
import IncomingCallControls from './call/IncomingCallControls';
import MeetingContainer from './call/MeetingContainer';

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
const VideoSDKCallModal: React.FC<VideoSDKCallModalProps> = (props) => {
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
    callIdHint,
  } = props;

  // ── Decoded display strings (URL-encoded params from the call window route) ─
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
    if (!isOpen) setSdkParticipantUserId(null);
  }, [isOpen]);

  // ── Token fetcher ───────────────────────────────────────────────────────────
  // Resolve userId from Supabase session here (not only from props). The call popup
  // often mounts before AuthContext hydrates `user?.id`, and JSON.stringify drops
  // `undefined` userId — the API then returns 400 "Missing roomId or userId".
  const getToken = useCallback(
    async (rid: string): Promise<{ token: string; userId: string }> => {
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

      if (!payload?.token || typeof payload.token !== 'string') {
        throw new Error('Invalid token response');
      }
      return { token: payload.token, userId: resolvedUserId };
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

  // ── Outgoing call: fetch token + optional room immediately on open ──────────
  useEffect(() => {
    if (!isOpen || isIncoming || hasInitRef.current) return;
    hasInitRef.current = true;

    const init = async () => {
      try {
        setPrePhase('connecting');
        let rid = roomIdHint;
        if (!rid) {
          const res = await fetch('/api/videosdk/room', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          if (!res.ok) throw new Error('Failed to create call room');
          const data = await res.json();
          rid = data.roomId as string | undefined;
          if (!rid) throw new Error('No room ID returned');
        }
        const { token: tok, userId: joinUid } = await getToken(rid);
        if (!isMountedRef.current) return;
        setSdkParticipantUserId(joinUid);
        setMeetingId(rid);
        setToken(tok);
      } catch (err: any) {
        if (!isMountedRef.current) return;
        // Allow retry when `currentUserId` hydrates after first paint or user refreshes.
        hasInitRef.current = false;
        setPrePhase('error');
        setErrorMsg(err.message || 'Failed to connect');
      }
    };

    init();
  }, [isOpen, isIncoming, roomIdHint, getToken, currentUserId]);

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
        await patchCallSessionWithRetry(threadId, { call_id: activeCallId, event });
      }
      onReject?.();
      setTimeout(() => onClose(), 500);
    },
    [stopRingtone, callIdHint, threadId, onReject, onClose],
  );

  const handleReject = useCallback(() => {
    void signalIncomingTerminal('declined');
  }, [signalIncomingTerminal]);

  const handleIncomingNoAnswer = useCallback(() => {
    void signalIncomingTerminal('missed');
  }, [signalIncomingTerminal]);

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
      const { token: tok, userId: joinUid } = await getToken(meetingId);
      if (!isMountedRef.current) return;
      setSdkParticipantUserId(joinUid);
      setToken(tok);
    } catch (err: any) {
      if (!isMountedRef.current) return;
      setIsAcceptingCall(false);
      setPrePhase('error');
      setErrorMsg(err.message || 'Failed to connect');
    }
  }, [isAcceptingCall, meetingId, threadId, callIdHint, getToken, stopRingtone]);

  // ── Early return: modal is closed ──────────────────────────────────────────
  if (!isOpen) return null;

  // ── Pre-call: incoming — ringing screen ────────────────────────────────────
  if (isIncoming && !token) {
    return (
      <div
        className="fixed inset-0 z-[9999] animate-fadeIn"
        style={{ background: 'linear-gradient(135deg, #ddd3c5 0%, #c7d9d1 100%)' }}
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
        className="fixed inset-0 z-[9999]"
        style={{ background: 'linear-gradient(135deg, #ddd3c5 0%, #c7d9d1 100%)' }}
      >
        {prePhase === 'error' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-800 p-8 text-center">
            <div className="text-lg font-semibold">Connection Failed</div>
            <div className="text-sm text-slate-600">{errorMsg}</div>
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

  // ── In-call: VideoSDK MeetingProvider wraps the call UI ────────────────────
  // Resolve the local participant's display name for the SDK (prefers URL param,
  // falls back to 'User' so the SDK always gets a non-empty string).
  const localDisplayName =
    decodedCallerName && decodedCallerName !== 'Unknown'
      ? decodedCallerName
      : 'User';

  return (
    <div className="fixed inset-0 z-[9999] animate-fadeIn">
      <MeetingProvider
        config={{
          meetingId,
          micEnabled: true,
          webcamEnabled: callType === 'video',
          name: localDisplayName,
          ...(sdkParticipantUserId ? { participantId: sdkParticipantUserId } : {}),
          mode: 'SEND_AND_RECV' as const,
          multiStream: false,
          debugMode: false,
        }}
        token={token}
        joinWithoutUserInteraction
      >
        <MeetingContainer
          isOpen={isOpen}
          onClose={onClose}
          callType={callType}
          isIncoming={isIncoming}
          onAccept={onAccept}
          onCallEnd={onCallEnd}
          threadId={threadId}
          currentUserId={currentUserId}
          roomIdHint={roomIdHint}
          callIdHint={callIdHint}
          meetingId={meetingId}
          resolvedCallerName={localDisplayName}
          decodedCallerName={decodedCallerName}
          decodedRecipientName={decodedRecipientName}
          decodedCallerAvatarUrl={decodedCallerAvatarUrl}
          decodedRecipientAvatarUrl={decodedRecipientAvatarUrl}
        />
      </MeetingProvider>
    </div>
  );
};

export { VideoSDKCallModal };
export type { VideoSDKCallModalProps };
export default VideoSDKCallModal;
