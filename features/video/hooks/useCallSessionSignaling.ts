/**
 * Provider-agnostic call session signaling — realtime, polling, resync, and terminal handling.
 * Shared between VideoSDK and LiveKit MeetingContainer implementations.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { supabaseMessagingService } from '@/features/chat/services/supabaseMessagingService';
import {
  callSessionRowToPollTerminalMessage,
  patchCallSessionWithRetry,
  toCallSessionStatusMessageType,
} from '@/features/chat/services/callSessionRealtime';
import {
  stopAll as stopAllRingtones,
} from '@/features/video/services/ringtoneService';
import type { CallStatus } from '@/features/video/core/types';
import type { CallParticipantProfile } from '@/features/video/ui/GroupCallParticipantsStrip';
import { broadcastCallUiStatus } from '@/features/video/hooks/broadcastCallUiStatus';

export interface UseCallSessionSignalingOptions {
  isOpen: boolean;
  threadId?: string;
  currentUserId?: string;
  callIdHint?: string;
  roomIdHint?: string;
  meetingId: string;
  isIncoming: boolean;
  callStatus: CallStatus;
  callStatusRef: React.MutableRefObject<CallStatus>;
  setCallStatusSafe: (next: CallStatus) => void;
  callDurationRef: React.MutableRefObject<number>;
  onClose: () => void;
  ringbackRef: React.MutableRefObject<{ stop: () => void } | null>;
  /** Called when outgoing ring times out (45s) — should PATCH missed + cleanup like handleEndCall. */
  onOutgoingRingTimeout?: () => void;
  /** Optional mid-call video switch support (LiveKit + VideoSDK). */
  onVideoSwitch?: {
    setEffectiveCallType: (t: 'audio' | 'video') => void;
    toggleWebcam: () => void;
    localWebcamOnRef: React.MutableRefObject<boolean>;
    setPendingVideoRequest: (v: { fromUserId: string } | null) => void;
  };
}

export function useCallSessionSignaling({
  isOpen,
  threadId,
  currentUserId,
  callIdHint,
  roomIdHint,
  meetingId,
  isIncoming,
  callStatus,
  callStatusRef,
  setCallStatusSafe,
  callDurationRef,
  onClose,
  ringbackRef,
  onOutgoingRingTimeout,
  onVideoSwitch,
}: UseCallSessionSignalingOptions) {
  const isIncomingRef = useRef(!!isIncoming);
  isIncomingRef.current = !!isIncoming;

  const [isGroupCallSession, setIsGroupCallSession] = useState(false);
  const [sessionHostId, setSessionHostId] = useState<string | null>(null);
  const [participantProfiles, setParticipantProfiles] = useState<CallParticipantProfile[]>([]);

  const suppressSignalRef = useRef(false);
  const remoteTerminalRef = useRef(false);
  const isGroupCallSessionRef = useRef(false);
  const sessionHostIdRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const normalizeSignalMeta = useCallback((rawMeta: unknown): Record<string, unknown> => {
    if (!rawMeta) return {};
    if (typeof rawMeta === 'string') {
      try {
        const p = JSON.parse(rawMeta);
        return p && typeof p === 'object' ? (p as Record<string, unknown>) : {};
      } catch {
        return {};
      }
    }
    if (typeof rawMeta === 'object') return rawMeta as Record<string, unknown>;
    return {};
  }, []);

  const shouldHandleSignal = useCallback(
    (msg: { thread_id?: string; sender_id?: string; metadata?: Record<string, unknown> }): boolean => {
      if (!msg || !threadId) return false;
      if (msg.thread_id && msg.thread_id !== threadId) return false;
      if (msg.sender_id && currentUserId && msg.sender_id === currentUserId) return false;
      const meta = normalizeSignalMeta(msg.metadata);
      const activeCallId = callIdHint || '';
      const activeRoomId = roomIdHint || meetingId;
      if (activeCallId && meta.callId && String(meta.callId) !== activeCallId) return false;
      if (activeRoomId && meta.roomId && String(meta.roomId) !== activeRoomId) return false;
      return true;
    },
    [threadId, currentUserId, callIdHint, roomIdHint, meetingId, normalizeSignalMeta],
  );

  const closeCall = useCallback(
    (delayMs = 1000) => {
      remoteTerminalRef.current = true;
      suppressSignalRef.current = true;
      if (ringbackRef.current) {
        ringbackRef.current.stop();
        ringbackRef.current = null;
      }
      stopAllRingtones();
      if (threadId) broadcastCallUiStatus('ended', threadId, callIdHint);
      if (isMountedRef.current) {
        setCallStatusSafe('ended');
        setTimeout(() => {
          if (isMountedRef.current) onClose();
        }, delayMs);
      }
    },
    [setCallStatusSafe, onClose, ringbackRef, threadId, callIdHint],
  );

  // Load session metadata (group call detection, call type sync)
  useEffect(() => {
    if (!isOpen || !threadId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const cid = (callIdHint || '').trim();
        const params = cid ? { call_id: cid } : { active: '1' };
        const res = await apiClient.get<{ session: Record<string, unknown> | null }>(
          `/api/chat/threads/${threadId}/call-sessions`,
          params,
        );
        if (cancelled || !res?.session) return;
        const row = res.session;
        const meta = normalizeSignalMeta(row.metadata);
        const group =
          meta.isGroupCall === true ||
          (Array.isArray(row.participants) && (row.participants as string[]).length > 2);
        isGroupCallSessionRef.current = group;
        sessionHostIdRef.current = String(row.created_by || '') || null;
        if (isMountedRef.current) {
          setIsGroupCallSession(group);
          setSessionHostId(sessionHostIdRef.current);
        }
        if (row.call_type === 'video' && onVideoSwitch && isMountedRef.current) {
          onVideoSwitch.setEffectiveCallType('video');
        }
        // Heartbeats overwrite last_signal, so derive pending from request timestamps.
        if (onVideoSwitch && isMountedRef.current && row.call_type !== 'video') {
          const requestedBy = meta.videoRequestedBy ? String(meta.videoRequestedBy) : '';
          const requestedAt = meta.videoRequestedAt
            ? Date.parse(String(meta.videoRequestedAt))
            : 0;
          const acceptedAt = meta.videoAcceptedAt
            ? Date.parse(String(meta.videoAcceptedAt))
            : 0;
          const declinedAt = meta.videoDeclinedAt
            ? Date.parse(String(meta.videoDeclinedAt))
            : 0;
          const isPendingRequest =
            !!requestedBy &&
            requestedBy !== currentUserId &&
            requestedAt > 0 &&
            requestedAt > acceptedAt &&
            requestedAt > declinedAt;
          onVideoSwitch.setPendingVideoRequest(
            isPendingRequest ? { fromUserId: requestedBy } : null,
          );
        } else if (onVideoSwitch && isMountedRef.current && row.call_type === 'video') {
          onVideoSwitch.setPendingVideoRequest(null);
        }
      } catch {
        /* ignore */
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, threadId, callIdHint, normalizeSignalMeta, onVideoSwitch, currentUserId]);

  // Network/tab resync
  //
  // Previously gated on `connected`/`connecting_media` only. That guard meant
  // the moment a call left those two statuses -- e.g. `reconnecting`, or any
  // other in-between state -- this check switched off at exactly the point a
  // call is struggling, and switched off together with the heartbeat's own
  // matching guard (see useCallHeartbeat `enabled` in each provider
  // container). A degraded client stopped proving liveness AND stopped
  // checking whether it should recover at the same time, so the server's
  // reaper could kill a session a working check would have caught in time.
  // Only skip once the call is already ended locally.
  useEffect(() => {
    if (!isOpen || !threadId) return;
    const resync = async () => {
      if (callStatusRef.current === 'ended') return;
      try {
        const cid = (callIdHint || '').trim();
        const params = cid
          ? { call_id: cid, include_participants: '1' }
          : { active: '1', include_participants: '1' };
        const res = await apiClient.get<{
          session: Record<string, unknown> | null;
          participant_profiles?: CallParticipantProfile[];
        }>(`/api/chat/threads/${threadId}/call-sessions`, params);
        const row = res?.session;
        if (!row) return;
        if (row.status === 'ended' || row.status === 'declined' || row.status === 'missed') {
          closeCall(800);
          return;
        }
        if (row.call_type === 'video' && onVideoSwitch) {
          onVideoSwitch.setEffectiveCallType('video');
          onVideoSwitch.setPendingVideoRequest(null);
        } else if (onVideoSwitch) {
          // Heartbeats overwrite last_signal, so derive pending from request timestamps.
          const meta = normalizeSignalMeta(row.metadata);
          const requestedBy = meta.videoRequestedBy ? String(meta.videoRequestedBy) : '';
          const requestedAt = meta.videoRequestedAt
            ? Date.parse(String(meta.videoRequestedAt))
            : 0;
          const acceptedAt = meta.videoAcceptedAt
            ? Date.parse(String(meta.videoAcceptedAt))
            : 0;
          const declinedAt = meta.videoDeclinedAt
            ? Date.parse(String(meta.videoDeclinedAt))
            : 0;
          const isPendingRequest =
            !!requestedBy &&
            requestedBy !== currentUserId &&
            requestedAt > 0 &&
            requestedAt > acceptedAt &&
            requestedAt > declinedAt;
          onVideoSwitch.setPendingVideoRequest(
            isPendingRequest ? { fromUserId: requestedBy } : null,
          );
        }
        if (Array.isArray(res.participant_profiles)) {
          setParticipantProfiles(res.participant_profiles);
        }
      } catch {
        /* ignore */
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void resync();
    };
    const onOnline = () => void resync();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [isOpen, threadId, callIdHint, closeCall, onVideoSwitch, callStatusRef, normalizeSignalMeta, currentUserId]);

  // 20s join timeout
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => {
      if (isMountedRef.current && callStatusRef.current === 'connecting') {
        console.warn('[useCallSessionSignaling] Meeting join timed out — closing.');
        closeCall(1500);
      }
    }, 20_000);
    return () => clearTimeout(t);
  }, [isOpen, closeCall, callStatusRef]);

  // 45s outgoing unanswered timeout
  useEffect(() => {
    if (!isOpen || isIncomingRef.current || callStatus !== 'ringing') return;
    const t = setTimeout(() => {
      if (callStatusRef.current === 'ringing') {
        if (onOutgoingRingTimeout) onOutgoingRingTimeout();
        else void signalOutgoingCancel();
      }
    }, 45_000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, callStatus, onOutgoingRingTimeout]);

  // Stop ringback when connected or ended
  useEffect(() => {
    if (
      callStatus === 'connected' ||
      callStatus === 'connecting_media' ||
      callStatus === 'ended'
    ) {
      if (ringbackRef.current) {
        ringbackRef.current.stop();
        ringbackRef.current = null;
      }
      stopAllRingtones();
    }
  }, [callStatus, ringbackRef]);

  // Auto-close modal when ended
  useEffect(() => {
    if (callStatus === 'ended' && isOpen) {
      const t = setTimeout(() => onClose(), 2000);
      return () => clearTimeout(t);
    }
  }, [callStatus, isOpen, onClose]);

  // Realtime signaling subscription
  useEffect(() => {
    if (!isOpen || !threadId) return;
    const unsub = supabaseMessagingService.subscribeToCallSignals(threadId, (msg) => {
      if (callStatusRef.current === 'ended') return;
      const mt = msg?.message_type;
      if (!mt || !shouldHandleSignal(msg)) return;
      const statusType = toCallSessionStatusMessageType(mt as string);
      const meta = normalizeSignalMeta(msg.metadata);

      if (onVideoSwitch) {
        if (statusType === 'switched_to_video' || statusType === 'video_accepted') {
          onVideoSwitch.setEffectiveCallType('video');
          onVideoSwitch.setPendingVideoRequest(null);
          if (!onVideoSwitch.localWebcamOnRef.current) onVideoSwitch.toggleWebcam();
          return;
        }
        if (statusType === 'switched_to_audio') {
          onVideoSwitch.setEffectiveCallType('audio');
          onVideoSwitch.setPendingVideoRequest(null);
          if (onVideoSwitch.localWebcamOnRef.current) onVideoSwitch.toggleWebcam();
          return;
        }
        if (statusType === 'video_requested' && meta.videoRequestedBy !== currentUserId) {
          onVideoSwitch.setPendingVideoRequest({
            fromUserId: String(meta.videoRequestedBy || msg.sender_id),
          });
          return;
        }
        if (statusType === 'video_declined') {
          onVideoSwitch.setPendingVideoRequest(null);
          toast.error('Video request declined');
          return;
        }
      }

      if (
        statusType === 'participant_joined' ||
        statusType === 'participant_left' ||
        statusType === 'participant_declined' ||
        statusType === 'participant_missed'
      ) {
        void (async () => {
          try {
            const cid = (callIdHint || '').trim();
            if (!cid) return;
            const res = await apiClient.get<{
              session: Record<string, unknown> | null;
              participant_profiles?: CallParticipantProfile[];
            }>(`/api/chat/threads/${threadId}/call-sessions`, {
              call_id: cid,
              include_participants: '1',
            });
            if (res?.participant_profiles) setParticipantProfiles(res.participant_profiles);
            const sessionStatus = String(res?.session?.status || '');
            if (
              sessionStatus === 'ended' ||
              sessionStatus === 'declined' ||
              sessionStatus === 'missed'
            ) {
              if (!isGroupCallSessionRef.current) closeCall(1000);
            }
          } catch {
            /* ignore */
          }
        })();
        return;
      }

      if (statusType === 'active' && !isIncomingRef.current) {
        if (ringbackRef.current) {
          ringbackRef.current.stop();
          ringbackRef.current = null;
        }
        stopAllRingtones();
        setCallStatusSafe('connecting_media');
        return;
      }

      if (
        (statusType === 'declined' ||
          statusType === 'missed' ||
          statusType === 'ended' ||
          statusType === 'failed') &&
        !remoteTerminalRef.current
      ) {
        if (
          (statusType === 'declined' || statusType === 'missed') &&
          isGroupCallSessionRef.current
        ) {
          return;
        }
        closeCall(1000);
      }
    });
    return () => unsub();
  }, [
    isOpen,
    threadId,
    shouldHandleSignal,
    closeCall,
    setCallStatusSafe,
    callIdHint,
    currentUserId,
    normalizeSignalMeta,
    onVideoSwitch,
    ringbackRef,
    callStatusRef,
  ]);

  // Polling fallback for outgoing pre-answer phase
  useEffect(() => {
    if (!isOpen || !threadId || isIncomingRef.current) return;
    if (callStatus === 'connected' || callStatus === 'connecting_media' || callStatus === 'ended') {
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const cid = (callIdHint || '').trim();
        if (!cid) return;
        const res = await apiClient.get<{ session: Record<string, unknown> | null }>(
          `/api/chat/threads/${threadId}/call-sessions`,
          { call_id: cid },
        );
        if (cancelled) return;
        const session = res?.session;
        if (!session) return;
        const sessionStatus = String(session.status || '');
        const latest =
          sessionStatus === 'ended' ||
          sessionStatus === 'declined' ||
          sessionStatus === 'missed' ||
          sessionStatus === 'failed'
            ? callSessionRowToPollTerminalMessage(session)
            : null;
        if (
          latest &&
          shouldHandleSignal(latest) &&
          !(isGroupCallSessionRef.current && (sessionStatus === 'declined' || sessionStatus === 'missed')) &&
          Date.now() -
            new Date(
              (latest as { updated_at?: string; created_at?: string }).updated_at ||
                (latest as { created_at?: string }).created_at ||
                0,
            ).getTime() <
            120_000
        ) {
          closeCall(1000);
        }
      } catch {
        /* ignore */
      }
    };
    const interval = setInterval(poll, 8000);
    const initial = setTimeout(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(initial);
    };
  }, [isOpen, threadId, callStatus, shouldHandleSignal, closeCall, callIdHint]);

  const signalOutgoingCancel = useCallback(async () => {
    const activeCallId = (callIdHint || '').trim();
    if (threadId && currentUserId && activeCallId) {
      await patchCallSessionWithRetry(threadId, {
        call_id: activeCallId,
        event: 'missed',
      });
    }
    closeCall(800);
  }, [threadId, currentUserId, callIdHint, closeCall]);

  /** Teardown signaling when media session disconnects unexpectedly (tab close, network). */
  const signalMediaDisconnected = useCallback(async () => {
    if (suppressSignalRef.current || remoteTerminalRef.current) return;
    if (!threadId || !currentUserId || callStatusRef.current === 'ended') return;

    const activeCallId = (callIdHint || '').trim();
    const isConnected =
      callStatusRef.current === 'connected' || callStatusRef.current === 'connecting_media';

    try {
      if (activeCallId) {
        if (isConnected) {
          const groupLeave = isGroupCallSessionRef.current;
          await patchCallSessionWithRetry(threadId, {
            call_id: activeCallId,
            event: groupLeave ? 'leave' : 'end',
            duration_seconds: callDurationRef.current,
          });
        } else if (!isIncomingRef.current) {
          await patchCallSessionWithRetry(threadId, {
            call_id: activeCallId,
            event: 'missed',
          });
        } else {
          await patchCallSessionWithRetry(threadId, {
            call_id: activeCallId,
            event: 'declined',
          });
        }
      }
    } catch {
      /* ignore */
    }

    if (threadId) broadcastCallUiStatus('ended', threadId, activeCallId);
    if (isMountedRef.current) {
      setCallStatusSafe('ended');
      setTimeout(() => {
        if (isMountedRef.current) onClose();
      }, 1000);
    }
  }, [
    threadId,
    currentUserId,
    callIdHint,
    callDurationRef,
    setCallStatusSafe,
    onClose,
    callStatusRef,
  ]);

  const signalCallTypeSwitch = useCallback(
    async (
      event:
        | 'switch_to_video'
        | 'switch_to_audio'
        | 'request_video'
        | 'accept_video'
        | 'decline_video',
    ) => {
      const activeCallId = (callIdHint || '').trim();
      if (!threadId || !activeCallId) return false;
      return patchCallSessionWithRetry(threadId, { call_id: activeCallId, event });
    },
    [threadId, callIdHint],
  );

  return {
    isGroupCallSession,
    sessionHostId,
    participantProfiles,
    setParticipantProfiles,
    isGroupCallSessionRef,
    sessionHostIdRef,
    suppressSignalRef,
    remoteTerminalRef,
    closeCall,
    signalMediaDisconnected,
    signalCallTypeSwitch,
    signalOutgoingCancel,
    broadcastEnded: () => {
      if (threadId) broadcastCallUiStatus('ended', threadId, callIdHint);
    },
  };
}
