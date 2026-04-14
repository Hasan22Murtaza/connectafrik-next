/**
 * MeetingContainer — core call experience powered by VideoSDK React SDK.
 *
 * Architecture:
 *   VideoSDKCallModal (MeetingProvider joinWithoutUserInteraction) → MeetingContainer (useMeeting)
 *     └─ ParticipantTile[]  (useParticipant per participant)
 *
 * Key facts about useMeeting:
 *  - `participants` Map contains ONLY remote participants (never local).
 *  - `localParticipant` is the local participant object (separate).
 *  - `localScreenShareOn` reflects whether the local user is screen-sharing.
 *  - `presenterId` is set to any current presenter's ID (local or remote).
 *  - Meeting joins automatically via `joinWithoutUserInteraction` on MeetingProvider.
 */
'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useMeeting } from '@videosdk.live/react-sdk';
import { PhoneOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getSessionIdFromAccessToken } from '@/shared/utils/sessionDeviceLabel';
import { supabaseMessagingService } from '@/features/chat/services/supabaseMessagingService';
import {
  callSessionRowToPollTerminalMessage,
  patchCallSessionWithRetry,
  toCallSessionStatusMessageType,
} from '@/features/chat/services/callSessionRealtime';
import {
  stopAll as stopAllRingtones,
  playRingbackTone,
} from '@/features/video/services/ringtoneService';
import { apiClient } from '@/lib/api-client';
import type { CallStatus, SpeakerLevel } from './types';
import { SPEAKER_VOLUMES } from './types';
import ParticipantTile from './ParticipantTile';
import ScreenShareView from './ScreenShareView';
import CallControls from './CallControls';
import CallStatusOverlay from './CallStatusOverlay';
import AddPeoplePanel from './AddPeoplePanel';
import MessageInput from './MessageInput';
import { LocalAdaptiveSendQuality } from './LocalAdaptiveSendQuality';

const LAST_PARTICIPANT_AUTO_END_MS = 5000;

// ---------------------------------------------------------------------------
// Broadcast call-active / call-ended to parent/opener tab via postMessage
// ---------------------------------------------------------------------------
function broadcastCallUiStatus(status: 'active' | 'ended', threadId: string | undefined) {
  if (typeof window === 'undefined' || !threadId) return;
  const payload = { type: 'CALL_STATUS', status, threadId };
  try { window.postMessage(payload, window.location.origin); } catch { /* ignore */ }
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(payload, window.location.origin);
    }
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface MeetingContainerProps {
  isOpen: boolean;
  onClose: () => void;
  callType: 'audio' | 'video';
  isIncoming?: boolean;
  onAccept?: () => void;
  onCallEnd?: () => void;
  threadId?: string;
  currentUserId?: string;
  roomIdHint?: string;
  callIdHint?: string;
  meetingId: string;
  resolvedCallerName: string;
  decodedCallerName: string;
  decodedRecipientName: string;
  decodedCallerAvatarUrl: string;
  decodedRecipientAvatarUrl: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const MeetingContainer: React.FC<MeetingContainerProps> = ({
  isOpen,
  onClose,
  callType,
  isIncoming = false,
  onAccept,
  onCallEnd,
  threadId,
  currentUserId,
  roomIdHint,
  callIdHint,
  meetingId,
  resolvedCallerName,
  decodedCallerName,
  decodedRecipientName,
  decodedCallerAvatarUrl,
  decodedRecipientAvatarUrl,
}) => {
  const { user, session } = useAuth();
  const callSessionDeviceFields = useMemo(() => {
    const id = getSessionIdFromAccessToken(session?.access_token ?? null);
    return id ? { device_session_id: id } : {};
  }, [session?.access_token]);

  // Keep latest isIncoming on a ref — VideoSDK may invoke useMeeting callbacks with
  // stale closures; reading this ref avoids the caller being treated like a callee
  // (which would jump straight to "connected" / in-call UI).
  const isIncomingRef = useRef(!!isIncoming);
  isIncomingRef.current = !!isIncoming;

  // --------------------------------------------------------------------------
  // UI state
  // --------------------------------------------------------------------------
  const [callStatus, setCallStatus] = useState<CallStatus>('connecting');
  const [callDuration, setCallDuration] = useState(0);
  const [speakerLevel, setSpeakerLevel] = useState<SpeakerLevel>('normal');
  const [showMessageInput, setShowMessageInput] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [showAddPeople, setShowAddPeople] = useState(false);
  const [addPeopleSearch, setAddPeopleSearch] = useState('');
  const [addPeopleResults, setAddPeopleResults] = useState<any[]>([]);
  const [addPeopleBusyById, setAddPeopleBusyById] = useState<Record<string, boolean>>({});
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);
  const [groupPage, setGroupPage] = useState(0);
  const [presenterName, setPresenterName] = useState('');
  /** Local video PiP: drag offset from default top-right anchor (px). */
  const [pipTranslate, setPipTranslate] = useState({ tx: 0, ty: 0 });
  const [pipDragging, setPipDragging] = useState(false);
  const pipTranslateRef = useRef(pipTranslate);
  pipTranslateRef.current = pipTranslate;

  // --------------------------------------------------------------------------
  // Refs — give async callbacks access to the latest values without stale closures
  // --------------------------------------------------------------------------
  const isMountedRef = useRef(true);
  const callStatusRef = useRef<CallStatus>('connecting');
  const callIdRef = useRef(callIdHint || '');
  const callDurationRef = useRef(0);
  const ringbackRef = useRef<{ stop: () => void } | null>(null);
  const suppressSignalRef = useRef(false);
  const remoteTerminalRef = useRef(false);
  const remoteDisconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Live copies of SDK state for use inside async callbacks
  const participantsRef = useRef<Map<string, any>>(new Map());
  const localParticipantRef = useRef<any>(null);
  // Stable MediaStream marker so CallControls can detect "someone else is sharing"
  const remoteScreenShareMarkerRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    const id = (callIdHint || '').trim();
    if (id) callIdRef.current = id;
  }, [callIdHint]);

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------
  const setCallStatusSafe = useCallback((next: CallStatus) => {
    if (callStatusRef.current === next) return;
    // UI state ↔ `call_sessions.status` (approximate):
    // - ringing / connecting_media: usually still `ringing` in DB until callee PATCH `accept`
    // - connected: DB `active` (both sides in room; callee should have PATCHed accept)
    // - ended: DB `ended` | `missed` | `declined`
    // Outgoing: never show "connected" until someone else is actually in the meeting.
    // Exclude local id if the SDK map incorrectly lists it as a "remote".
    if (next === 'connected' && !isIncomingRef.current) {
      const lid = localParticipantRef.current?.id;
      const keys = [...participantsRef.current.keys()];
      const remoteCount = lid ? keys.filter((id) => id !== lid).length : keys.length;
      if (remoteCount < 1) return;
    }
    const prev = callStatusRef.current;
    callStatusRef.current = next;
    if (isMountedRef.current) setCallStatus(next);
    // Tell the parent/opener the call is truly live (remote answered + media path).
    // Do not broadcast on outgoing "ringing" — only when we reach connected.
    if (next === 'connected' && prev !== 'connected' && threadId) {
      broadcastCallUiStatus('active', threadId);
    }
  }, [threadId]);

  const formatDuration = useCallback((secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }, []);

  const normalizeSignalMeta = useCallback((rawMeta: unknown): Record<string, any> => {
    if (!rawMeta) return {};
    if (typeof rawMeta === 'string') {
      try { const p = JSON.parse(rawMeta); return p && typeof p === 'object' ? (p as Record<string, any>) : {}; }
      catch { return {}; }
    }
    if (typeof rawMeta === 'object') return rawMeta as Record<string, any>;
    return {};
  }, []);

  const shouldHandleSignal = useCallback(
    (msg: any): boolean => {
      if (!msg || !threadId) return false;
      if (msg.thread_id && msg.thread_id !== threadId) return false;
      if (msg.sender_id && currentUserId && msg.sender_id === currentUserId) return false;
      const meta = normalizeSignalMeta(msg.metadata);
      const activeCallId = callIdRef.current || callIdHint || '';
      const activeRoomId = roomIdHint || meetingId;
      if (activeCallId && meta.callId && meta.callId !== activeCallId) return false;
      if (activeRoomId && meta.roomId && meta.roomId !== activeRoomId) return false;
      return true;
    },
    [threadId, currentUserId, callIdHint, roomIdHint, meetingId, normalizeSignalMeta],
  );

  const closeCall = useCallback(
    (delayMs = 1000) => {
      remoteTerminalRef.current = true;
      suppressSignalRef.current = true;
      if (ringbackRef.current) { ringbackRef.current.stop(); ringbackRef.current = null; }
      stopAllRingtones();
      if (isMountedRef.current) {
        setCallStatusSafe('ended');
        setTimeout(() => { if (isMountedRef.current) onClose(); }, delayMs);
      }
    },
    [setCallStatusSafe, onClose],
  );

  const clearRemoteDisconnectTimer = useCallback(() => {
    if (remoteDisconnectTimerRef.current) {
      clearTimeout(remoteDisconnectTimerRef.current);
      remoteDisconnectTimerRef.current = null;
    }
  }, []);

  const scheduleAutoEndWhenAlone = useCallback(() => {
    if (remoteDisconnectTimerRef.current) return;
    remoteDisconnectTimerRef.current = setTimeout(async () => {
      remoteDisconnectTimerRef.current = null;
      if (!isMountedRef.current || callStatusRef.current !== 'connected') return;
      const lid = localParticipantRef.current?.id;
      const keys = [...participantsRef.current.keys()];
      const remoteCount = lid ? keys.filter((id) => id !== lid).length : keys.length;
      if (remoteCount !== 0) return;
      const activeCallId = callIdRef.current || callIdHint || '';
      if (threadId && currentUserId && activeCallId) {
        await patchCallSessionWithRetry(threadId, {
          call_id: activeCallId,
          event: 'end',
          duration_seconds: callDurationRef.current,
        });
      }
      setCallStatusSafe('ended');
      setTimeout(() => { if (isMountedRef.current) onClose(); }, 1000);
    }, LAST_PARTICIPANT_AUTO_END_MS);
  }, [callIdHint, currentUserId, onClose, setCallStatusSafe, threadId]);

  // --------------------------------------------------------------------------
  // useMeeting — central react-sdk hook
  // NOTE: meeting auto-joins via joinWithoutUserInteraction={true} on MeetingProvider.
  // NOTE: `participants` contains ONLY remote participants (excluding local).
  // --------------------------------------------------------------------------
  const {
    leave,
    toggleMic,
    toggleWebcam,
    enableScreenShare,
    disableScreenShare,
    participants,         // remote participants only
    localParticipant,
    localMicOn,
    localWebcamOn,
    localScreenShareOn,  // true when local user is screen-sharing
    presenterId,         // ID of whoever is presenting (local or remote)
  } = useMeeting({
    // Fired once the local participant successfully joins the meeting room
    onMeetingJoined: () => {
      if (!isMountedRef.current) return;
      if (isIncomingRef.current) {
        // Callee joined VideoSDK — show in-call UI (caller may join a moment later)
        setCallStatusSafe('connected');
        onAccept?.();
        const joinedCallId = callIdRef.current || callIdHint || '';
        if (threadId && currentUserId && joinedCallId) {
          void patchCallSessionWithRetry(threadId, {
            call_id: joinedCallId,
            event: 'accept',
            ...callSessionDeviceFields,
          });
        }
      } else {
        // Caller joined — stay on ringing until a remote participant appears
        setCallStatusSafe('ringing');
        playRingbackTone().then((r) => {
          if (isMountedRef.current) ringbackRef.current = r;
        });
      }
    },

    // Fired when the meeting is left (explicitly or by the server)
    onMeetingLeft: () => {
      void (async () => {
        const shouldSignal = !suppressSignalRef.current;
        if (shouldSignal && threadId && currentUserId && callStatusRef.current !== 'ended') {
          const activeCallId = callIdRef.current || callIdHint || '';
          const activeRoomId = roomIdHint || meetingId;
          const isConnected =
            callStatusRef.current === 'connected' ||
            callStatusRef.current === 'connecting_media';
          try {
            if (activeCallId) {
              if (isConnected) {
                const ok = await patchCallSessionWithRetry(threadId, {
                  call_id: activeCallId,
                  event: 'end',
                  duration_seconds: callDurationRef.current,
                });
                if (ok) {
                  await supabaseMessagingService.sendMessage(
                    threadId,
                    { content: 'Call ended', message_type: 'ended',
                      metadata: { callType, roomId: activeRoomId, callId: activeCallId,
                        endedBy: currentUserId, endedAt: new Date().toISOString() } },
                    { id: currentUserId, name: user?.user_metadata?.full_name || 'User' },
                  );
                }
              } else if (!isIncomingRef.current) {
                const ok = await patchCallSessionWithRetry(threadId, {
                  call_id: activeCallId,
                  event: 'missed',
                });
                if (ok) {
                  await supabaseMessagingService.sendMessage(
                    threadId,
                    { content: 'Missed call', message_type: 'missed',
                      metadata: { callType, roomId: activeRoomId, callId: activeCallId,
                        endedBy: currentUserId, endedAt: new Date().toISOString() } },
                    { id: currentUserId, name: user?.user_metadata?.full_name || 'User' },
                  );
                }
              } else {
                await patchCallSessionWithRetry(threadId, {
                  call_id: activeCallId,
                  event: 'declined',
                  ...callSessionDeviceFields,
                });
              }
            }
          } catch { /* ignore signaling errors on teardown */ }
        }
        if (isMountedRef.current) {
          setCallStatusSafe('ended');
          setTimeout(() => { if (isMountedRef.current) onClose(); }, 1000);
        }
      })();
    },

    // Remote participant joined the room
    onParticipantJoined: () => {
      if (!isMountedRef.current) return;
      clearRemoteDisconnectTimer();
      // Outgoing call: first remote joins → stop ringback, enter connecting_media
      if (!isIncomingRef.current) {
        if (ringbackRef.current) { ringbackRef.current.stop(); ringbackRef.current = null; }
        stopAllRingtones();
        if (callStatusRef.current === 'ringing' || callStatusRef.current === 'connecting') {
          setCallStatusSafe('connecting_media');
        }
      }
    },

    // Remote participant left the room
    onParticipantLeft: () => {
      if (!isMountedRef.current) return;
      setTimeout(() => {
        if (!isMountedRef.current) return;
        const lid = localParticipantRef.current?.id;
        const keys = [...participantsRef.current.keys()];
        const remoteCount = lid ? keys.filter((id) => id !== lid).length : keys.length;
        // If everyone else left (group or 1:1), end the call after a short grace period.
        if (remoteCount === 0 && callStatusRef.current === 'connected') {
          scheduleAutoEndWhenAlone();
        }
      }, 300);
    },

    // Screen-share presenter changed
    onPresenterChanged: (pid: string | null) => {
      if (!isMountedRef.current) return;
      if (pid && pid !== localParticipantRef.current?.id) {
        const presenter = participantsRef.current.get(pid);
        setPresenterName(presenter?.displayName || 'Participant');
      } else {
        setPresenterName('');
      }
    },

    // Active speaker changed — ParticipantTile reads `isActiveSpeaker` directly
    onSpeakerChanged: () => {},

    onError: (err: any) => {
      console.error('[MeetingContainer] VideoSDK error:', err);
      // If the error fires before the meeting ever joined, transition to ended
      // so the user sees a clear "Call Ended" state instead of an infinite spinner.
      if (isMountedRef.current && callStatusRef.current === 'connecting') {
        setCallStatusSafe('ended');
        setTimeout(() => { if (isMountedRef.current) onClose(); }, 2000);
      }
    },
  });

  // Keep refs in sync with latest SDK state
  useEffect(() => { participantsRef.current = participants; }, [participants]);
  useEffect(() => { localParticipantRef.current = localParticipant; }, [localParticipant]);

  // Fallback for SDK timing/order edge-cases:
  // if callbacks are missed but participant map reaches 0 remotes while connected,
  // still auto-end the call.
  useEffect(() => {
    if (callStatus !== 'connected') {
      clearRemoteDisconnectTimer();
      return;
    }
    const lid = localParticipant?.id;
    const remoteN = lid
      ? [...participants.keys()].filter((id) => id !== lid).length
      : participants.size;
    if (remoteN === 0) scheduleAutoEndWhenAlone();
    else clearRemoteDisconnectTimer();
  }, [
    callStatus,
    participants,
    localParticipant?.id,
    scheduleAutoEndWhenAlone,
    clearRemoteDisconnectTimer,
  ]);

  useEffect(() => () => clearRemoteDisconnectTimer(), [clearRemoteDisconnectTimer]);

  // --------------------------------------------------------------------------
  // 20-second safety timeout: if the meeting never joins after mounting,
  // close the call so the user isn't left on a spinning "Connecting..." screen.
  // --------------------------------------------------------------------------
  useEffect(() => {
    const t = setTimeout(() => {
      if (isMountedRef.current && callStatusRef.current === 'connecting') {
        console.warn('[MeetingContainer] Meeting join timed out — closing.');
        setCallStatusSafe('ended');
        setTimeout(() => { if (isMountedRef.current) onClose(); }, 1500);
      }
    }, 20_000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --------------------------------------------------------------------------
  // connecting_media → connected when remote streams start flowing (outgoing calls)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (callStatus !== 'connecting_media') return;
    const lid = localParticipant?.id;
    const remoteN = lid
      ? [...participants.keys()].filter((id) => id !== lid).length
      : participants.size;
    if (remoteN > 0) {
      const t = setTimeout(() => setCallStatusSafe('connected'), 600);
      return () => clearTimeout(t);
    }
  }, [participants, localParticipant?.id, callStatus, setCallStatusSafe]);

  // --------------------------------------------------------------------------
  // Safety net: if participants arrive while still in ringing state (e.g. the
  // callee joined before onParticipantJoined fired), drive the state forward.
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (callStatus !== 'ringing' || isIncomingRef.current) return;
    const lid = localParticipant?.id;
    const remoteN = lid
      ? [...participants.keys()].filter((id) => id !== lid).length
      : participants.size;
    if (remoteN > 0) {
      if (ringbackRef.current) { ringbackRef.current.stop(); ringbackRef.current = null; }
      stopAllRingtones();
      setCallStatusSafe('connecting_media');
    }
  }, [participants, localParticipant?.id, callStatus, setCallStatusSafe]);

  // --------------------------------------------------------------------------
  // Call duration timer
  // --------------------------------------------------------------------------
  useEffect(() => { callDurationRef.current = callDuration; }, [callDuration]);
  useEffect(() => {
    if (callStatus !== 'connected') return;
    const interval = setInterval(() => setCallDuration((p) => p + 1), 1000);
    return () => clearInterval(interval);
  }, [callStatus]);

  // --------------------------------------------------------------------------
  // Stop ringback when call becomes connected or ends
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (callStatus === 'connected' || callStatus === 'connecting_media' || callStatus === 'ended') {
      if (ringbackRef.current) { ringbackRef.current.stop(); ringbackRef.current = null; }
      stopAllRingtones();
    }
  }, [callStatus]);

  // --------------------------------------------------------------------------
  // Auto-close modal when call ends
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (callStatus === 'ended' && isOpen) {
      const t = setTimeout(() => onClose(), 2000);
      return () => clearTimeout(t);
    }
  }, [callStatus, isOpen, onClose]);

  // --------------------------------------------------------------------------
  // 45s auto-timeout for outgoing unanswered calls
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (callStatus !== 'ringing' || isIncomingRef.current) return;
    const t = setTimeout(() => {
      if (callStatusRef.current === 'ringing') handleEndCall();
    }, 45000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callStatus]);

  // --------------------------------------------------------------------------
  // Supabase realtime signaling subscription
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen || !threadId) return;
    const unsub = supabaseMessagingService.subscribeToCallSignals(threadId, (msg) => {
      if (callStatusRef.current === 'ended') return;
      const mt = msg?.message_type;
      if (!mt || !shouldHandleSignal(msg)) return;
      const statusType = toCallSessionStatusMessageType(mt as string);
      // Callee accepted on another device → stop ringback, wait for media
      if (statusType === 'active' && !isIncomingRef.current) {
        if (ringbackRef.current) { ringbackRef.current.stop(); ringbackRef.current = null; }
        stopAllRingtones();
        setCallStatusSafe('connecting_media');
        return;
      }
      // Remote terminal signal → close UI
      if (
        (statusType === 'declined' || statusType === 'missed' ||
          statusType === 'ended' || statusType === 'failed') &&
        !remoteTerminalRef.current
      ) {
        closeCall(1000);
      }
    });
    return () => unsub();
  }, [isOpen, threadId, shouldHandleSignal, closeCall, setCallStatusSafe]);

  // --------------------------------------------------------------------------
  // Polling fallback for outgoing calls during pre-answer phase (8s interval)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen || !threadId || isIncomingRef.current) return;
    if (callStatus === 'connected' || callStatus === 'connecting_media' || callStatus === 'ended') return;
    let cancelled = false;
    const poll = async () => {
      try {
        const cid = callIdRef.current || callIdHint || '';
        if (!cid) return;
        const res = await apiClient.get<{ session: Record<string, unknown> | null }>(
          `/api/chat/threads/${threadId}/call-sessions`, { call_id: cid },
        );
        if (cancelled) return;
        const latest = res?.session ? callSessionRowToPollTerminalMessage(res.session) : null;
        if (
          latest && shouldHandleSignal(latest) &&
          Date.now() - new Date(
            (latest as any).updated_at || (latest as any).created_at,
          ).getTime() < 120_000
        ) {
          closeCall(1000);
        }
      } catch { /* ignore */ }
    };
    const interval = setInterval(poll, 8000);
    const initial = setTimeout(poll, 4000);
    return () => { cancelled = true; clearInterval(interval); clearTimeout(initial); };
  }, [isOpen, threadId, callStatus, shouldHandleSignal, closeCall, callIdHint]);

  // --------------------------------------------------------------------------
  // Add-people search (debounced 300ms)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!showAddPeople || !addPeopleSearch.trim() || addPeopleSearch.length < 2) {
      setAddPeopleResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await apiClient.get<{ data: any[] }>('/api/users/search', {
          q: addPeopleSearch, limit: 10,
        });
        if (isMountedRef.current) {
          setAddPeopleResults((res?.data || []).filter((u: any) => u.id !== currentUserId));
        }
      } catch { setAddPeopleResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [addPeopleSearch, showAddPeople, currentUserId]);

  // Who is in another call (call_sessions), excluding this meeting's call_id
  useEffect(() => {
    if (!showAddPeople || addPeopleResults.length === 0) {
      setAddPeopleBusyById({});
      return;
    }
    let cancelled = false;
    const ids = addPeopleResults.map((u: any) => u.id).filter(Boolean);
    const run = async () => {
      try {
        const exclude = (callIdRef.current || callIdHint || '').trim();
        const res = await apiClient.post<{ busy: Record<string, boolean> }>(
          '/api/videosdk/room',
          {
            busy_check: true,
            user_ids: ids,
            ...(exclude ? { exclude_call_id: exclude } : {}),
          },
        );
        if (!cancelled && res?.busy) setAddPeopleBusyById(res.busy);
      } catch {
        if (!cancelled) setAddPeopleBusyById({});
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [showAddPeople, addPeopleResults, callIdHint]);

  // --------------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------------
  const handleEndCall = useCallback(async () => {
    const activeCallId = callIdRef.current || callIdHint || '';
    const activeRoomId = roomIdHint || meetingId;
    const isConnected =
      callStatusRef.current === 'connected' || callStatusRef.current === 'connecting_media';

    if (threadId && currentUserId) {
      try {
        if (isConnected && activeCallId) {
          const ok = await patchCallSessionWithRetry(threadId, {
            call_id: activeCallId,
            event: 'end',
            duration_seconds: callDurationRef.current,
          });
          if (ok) {
            await supabaseMessagingService.sendMessage(
              threadId,
              { content: 'Call ended', message_type: 'ended',
                metadata: { callType, roomId: activeRoomId, callId: activeCallId,
                  endedBy: currentUserId, endedAt: new Date().toISOString() } },
              { id: currentUserId, name: user?.user_metadata?.full_name || 'User' },
            );
          }
        } else if (!isIncoming && activeCallId) {
          const ok = await patchCallSessionWithRetry(threadId, {
            call_id: activeCallId,
            event: 'missed',
          });
          if (ok) {
            await supabaseMessagingService.sendMessage(
              threadId,
              { content: 'Missed call', message_type: 'missed',
                metadata: { callType, roomId: activeRoomId, callId: activeCallId,
                  endedBy: currentUserId, endedAt: new Date().toISOString() } },
              { id: currentUserId, name: user?.user_metadata?.full_name || 'User' },
            );
          }
        } else if (isIncoming && activeCallId) {
          await patchCallSessionWithRetry(threadId, {
            call_id: activeCallId,
            event: 'declined',
            ...callSessionDeviceFields,
          });
        }
      } catch { /* ignore signaling errors */ }
    }

    suppressSignalRef.current = true;
    try { leave(); } catch { /* ignore */ }
    setCallStatusSafe('ended');
    onCallEnd?.();
    setTimeout(() => { if (isMountedRef.current) onClose(); }, 1000);
  }, [callIdHint, roomIdHint, meetingId, threadId, currentUserId, callType, isIncoming,
    leave, setCallStatusSafe, onCallEnd, onClose, user, callSessionDeviceFields]);

  const handleToggleMic = useCallback(() => toggleMic(), [toggleMic]);

  const handleToggleVideo = useCallback(() => {
    if (callType !== 'video') return;
    toggleWebcam();
  }, [callType, toggleWebcam]);

  const handleToggleSpeaker = useCallback(() => {
    setSpeakerLevel((prev) =>
      prev === 'normal' ? 'loud' : prev === 'loud' ? 'low' : 'normal',
    );
  }, []);

  // localScreenShareOn from useMeeting is the authoritative flag for local screen sharing
  const handleToggleScreenShare = useCallback(() => {
    if (localScreenShareOn) disableScreenShare();
    else enableScreenShare();
  }, [localScreenShareOn, enableScreenShare, disableScreenShare]);

  const handleSendMessage = useCallback(async () => {
    if (!messageText.trim() || !threadId || !currentUserId) return;
    try {
      await supabaseMessagingService.sendMessage(
        threadId,
        { content: messageText.trim(), message_type: 'text' },
        { id: currentUserId, name: user?.user_metadata?.full_name || 'User' },
      );
      setMessageText('');
      setShowMessageInput(false);
    } catch { /* ignore */ }
  }, [messageText, threadId, currentUserId, user]);

  const handleInviteToCall = useCallback(
    async (targetUser: { id: string; full_name: string; username: string }) => {
      if (!currentUserId || invitingUserId) return;
      const exclude = (callIdRef.current || callIdHint || '').trim();
      try {
        const busyRes = await apiClient.post<{ busy: Record<string, boolean> }>(
          '/api/videosdk/room',
          {
            busy_check: true,
            user_ids: [targetUser.id],
            ...(exclude ? { exclude_call_id: exclude } : {}),
          },
        );
        if (busyRes.busy?.[targetUser.id]) {
          toast.error('This person is already in another call.');
          return;
        }
      } catch {
        /* proceed; server invite may still be authoritative */
      }
      setInvitingUserId(targetUser.id);
      try {
        const threadRes = await apiClient.post<{ data: { id: string } }>(
          '/api/chat/threads', { participant_ids: [targetUser.id], type: 'direct' },
        );
        const directThreadId = threadRes?.data?.id;
        if (!directThreadId) throw new Error('Thread not found');
        await apiClient.post(`/api/chat/threads/${directThreadId}/call-sessions`, {
          call_id: callIdRef.current || callIdHint || '',
          call_type: callType,
          room_id: roomIdHint || meetingId,
          target_user_id: targetUser.id,
          is_group_call: true,
          caller_name: resolvedCallerName,
        });
        setShowAddPeople(false);
        setAddPeopleSearch('');
        setAddPeopleResults([]);
      } catch (err: any) {
        console.error('[MeetingContainer] Failed to invite:', err);
        toast.error(err?.message || 'Could not add this person to the call.');
      } finally {
        setInvitingUserId(null);
      }
    },
    [currentUserId, invitingUserId, callIdHint, callType, roomIdHint, meetingId, resolvedCallerName],
  );

  // --------------------------------------------------------------------------
  // Derived participant state
  //
  // Docs say `useMeeting().participants` excludes local — in practice the map can
  // still contain `localParticipant.id` (e.g. timing/relay edge cases). If we don't
  // filter, `gridLayout` treats it as an extra remote and builds
  // [...remotes, localId] → duplicate local tiles + wrong "3 participants" in 1:1.
  // --------------------------------------------------------------------------
  const localId = localParticipant?.id;

  const remoteParticipantIds = useMemo(() => {
    const ids = Array.from(participants.keys());
    if (!localId) return [...new Set(ids)];
    return [...new Set(ids.filter((id) => id !== localId))];
  }, [participants, localId]);

  /** Aligns with `call_sessions.participants` when SDK `participantId` = Supabase user id. */
  const inCallUserIds = useMemo(() => {
    const s = new Set<string>();
    if (localId) s.add(localId);
    remoteParticipantIds.forEach((id) => s.add(id));
    return Array.from(s);
  }, [localId, remoteParticipantIds]);

  const participantCount = remoteParticipantIds.length + 1; // +1 for local
  const isGroupCall = remoteParticipantIds.length > 1;

  // VideoSDK state → UI flags
  const isMuted = !localMicOn;
  const isVideoEnabled = localWebcamOn;
  // localScreenShareOn is the authoritative SDK flag for local screen sharing
  const isLocalPresenting = localScreenShareOn;
  // Remote presenter: presenterId is set when anyone is sharing; exclude local
  const remotePresenter = presenterId && presenterId !== localId ? presenterId : null;

  // Maintain a stable MediaStream marker so CallControls can tell that someone
  // else is sharing (without needing the actual stream bytes)
  if (remotePresenter && !remoteScreenShareMarkerRef.current) {
    remoteScreenShareMarkerRef.current = new MediaStream();
  } else if (!remotePresenter) {
    remoteScreenShareMarkerRef.current = null;
  }

  const audioVolume = SPEAKER_VOLUMES[speakerLevel];

  // Paginated group grid (2+ remote participants)
  const gridLayout = useMemo(() => {
    if (remoteParticipantIds.length <= 1) return null;
    const MAX_PER_PAGE = 8;
    const pageCount = Math.max(1, Math.ceil(remoteParticipantIds.length / MAX_PER_PAGE));
    const pageIndex = Math.min(groupPage, pageCount - 1);
    const start = pageIndex * MAX_PER_PAGE;
    const visibleRemote = remoteParticipantIds.slice(start, start + MAX_PER_PAGE);
    const allTiles = localId ? [...visibleRemote, localId] : visibleRemote;
    const total = allTiles.length;
    const cols = total <= 2 ? 2 : total <= 4 ? 2 : total <= 9 ? 3 : 4;
    const rows = Math.ceil(total / cols);
    return { visibleRemote, allTiles, total, cols, rows, pageIndex, pageCount };
  }, [remoteParticipantIds, localId, groupPage]);

  // Reset to page 0 when participants join/leave
  useEffect(() => { setGroupPage(0); }, [remoteParticipantIds.length]);

  const meetingSurfaceRef = useRef<HTMLDivElement>(null);
  const pipWrapRef = useRef<HTMLDivElement>(null);
  const pipPointerIdRef = useRef<number | null>(null);
  const pipDragStartRef = useRef<{ cx: number; cy: number; tx: number; ty: number } | null>(null);

  const clampPipTranslate = useCallback((tx: number, ty: number) => {
    const surface = meetingSurfaceRef.current;
    const pip = pipWrapRef.current;
    if (!surface || !pip) return { tx, ty };
    const sw = surface.clientWidth;
    const sh = surface.clientHeight;
    const pw = pip.offsetWidth;
    const ph = pip.offsetHeight;
    const m = 12;
    const baseLeft = sw - m - pw;
    const baseTop = m;
    const l = baseLeft + tx;
    const t = baseTop + ty;
    const cl = Math.min(Math.max(l, m), sw - m - pw);
    const ct = Math.min(Math.max(t, m), sh - m - ph);
    return { tx: cl - baseLeft, ty: ct - baseTop };
  }, []);

  useEffect(() => {
    const onResize = () => {
      setPipTranslate((p) => clampPipTranslate(p.tx, p.ty));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clampPipTranslate]);

  const onPipPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pipPointerIdRef.current = e.pointerId;
    setPipDragging(true);
    const p = pipTranslateRef.current;
    pipDragStartRef.current = { cx: e.clientX, cy: e.clientY, tx: p.tx, ty: p.ty };
  }, []);

  const onPipPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerId !== pipPointerIdRef.current || !pipDragStartRef.current) return;
      const s = pipDragStartRef.current;
      const dx = e.clientX - s.cx;
      const dy = e.clientY - s.cy;
      setPipTranslate(clampPipTranslate(s.tx + dx, s.ty + dy));
    },
    [clampPipTranslate],
  );

  const onPipPointerUp = useCallback((e: React.PointerEvent) => {
    if (e.pointerId !== pipPointerIdRef.current) return;
    pipPointerIdRef.current = null;
    pipDragStartRef.current = null;
    setPipDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  return (
    <div className="w-full h-full overflow-hidden">
      <div
        ref={meetingSurfaceRef}
        className="relative w-full h-screen overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #ddd3c5 0%, #c7d9d1 100%)' }}
      >
        {/* ── Screen share view (remote full-screen OR local banner) ─────── */}
        {(remotePresenter || isLocalPresenting) && (
          <ScreenShareView
            presenterId={remotePresenter ?? (localId || '')}
            presenterName={presenterName}
            remoteParticipantIds={remoteParticipantIds}
            localParticipantId={localId ?? null}
            isLocalPresenting={isLocalPresenting}
            callDuration={callDuration}
            participantCount={participantCount}
            formatDuration={formatDuration}
            audioVolume={audioVolume}
            onStopSharing={handleToggleScreenShare}
          />
        )}

        {/* ── 1-on-1: remote media — video fills screen; audio uses overlay for UI but needs
            a ParticipantTile so remote micStream is played (CallStatusOverlay has no audio). */}
        {!gridLayout &&
          !remotePresenter &&
          remoteParticipantIds.length === 1 &&
          (callStatus === 'connected' || callStatus === 'connecting_media') &&
          (callType === 'video' ? (
            <div className="absolute inset-0">
              <ParticipantTile
                participantId={remoteParticipantIds[0]}
                tileCount={1}
                showNameLabel={false}
                audioVolume={audioVolume}
              />
            </div>
          ) : (
            <ParticipantTile
              participantId={remoteParticipantIds[0]}
              audioOnly
              audioVolume={audioVolume}
            />
          ))}

        {/* ── Group video grid (2+ remote participants) ─────────────────── */}
        {gridLayout && !remotePresenter && (
          <div
            className="absolute inset-0 flex flex-wrap justify-center content-center p-1.5 sm:p-2 md:p-3"
            style={{
              gap: '4px',
              background: 'linear-gradient(135deg, #ddd3c5 0%, #c7d9d1 100%)',
            }}
          >
            {gridLayout.allTiles.map((pid) => (
              <div
                key={pid}
                className="relative overflow-hidden rounded-md sm:rounded-lg"
                style={{
                  width: `calc(${100 / gridLayout.cols}% - 6px)`,
                  height: `calc(${100 / gridLayout.rows}% - 6px)`,
                  minHeight: 0,
                }}
              >
                <ParticipantTile
                  participantId={pid}
                  isLocal={pid === localId}
                  tileCount={gridLayout.total}
                  showNameLabel
                  audioVolume={audioVolume}
                />
              </div>
            ))}

            {gridLayout.pageCount > 1 && (
              <div className="absolute top-2 right-2 z-10 flex items-center gap-2 bg-black/60 text-white rounded-full px-2.5 py-1.5 backdrop-blur-sm border border-white/20">
                <button
                  onClick={() => setGroupPage((p) => Math.max(0, p - 1))}
                  disabled={gridLayout.pageIndex === 0}
                  className="text-xs px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Previous page"
                >
                  Prev
                </button>
                <span className="text-xs tabular-nums">
                  {gridLayout.pageIndex + 1}/{gridLayout.pageCount}
                </span>
                <button
                  onClick={() =>
                    setGroupPage((p) => Math.min(gridLayout.pageCount - 1, p + 1))
                  }
                  disabled={gridLayout.pageIndex >= gridLayout.pageCount - 1}
                  className="text-xs px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Next page"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Local video PiP (1-on-1 video, no screen share) — draggable ─ */}
        {localId &&
          callType === 'video' &&
          !gridLayout &&
          !remotePresenter &&
          isVideoEnabled &&
          callStatus === 'connected' && (
            <div
              ref={pipWrapRef}
              role="region"
              aria-label="Your camera preview — drag to move on screen"
              title="Drag to move"
              className={`absolute top-3 right-3 z-20 w-20 h-28 touch-none select-none rounded-lg border border-white shadow-xl ring-1 ring-white/20 sm:h-32 sm:w-24 md:h-44 md:w-32 sm:border-2 ${
                pipDragging
                  ? 'cursor-grabbing overflow-hidden'
                  : 'cursor-grab overflow-hidden transition-transform duration-200 hover:scale-105'
              }`}
              style={{
                transform: `translate3d(${pipTranslate.tx}px, ${pipTranslate.ty}px, 0)`,
              }}
              onPointerDown={onPipPointerDown}
              onPointerMove={onPipPointerMove}
              onPointerUp={onPipPointerUp}
              onPointerCancel={onPipPointerUp}
            >
              <ParticipantTile
                participantId={localId}
                isLocal
                tileCount={2}
                showNameLabel={false}
                audioVolume={0}
              />
            </div>
          )}

        {/* ── Participant count badge ───────────────────────────────────── */}
        {callStatus === 'connected' &&
          !remotePresenter &&
          !isLocalPresenting &&
          participantCount > 2 && (
            <div className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-black/60 backdrop-blur-md text-white px-2.5 py-1.5 rounded-full text-xs font-medium shadow-lg border border-white/20 z-20">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                {participantCount} participants
              </span>
            </div>
          )}

        {/* ── Duration timer (bottom-left, video / group) ───────────────── */}
        {callStatus === 'connected' &&
          (callType === 'video' || isGroupCall) &&
          !remotePresenter &&
          !isLocalPresenting && (
            <div className="absolute bottom-16 sm:bottom-20 left-3 sm:left-4 text-xs sm:text-sm font-bold tracking-wider text-slate-800 font-mono tabular-nums z-30">
              {formatDuration(callDuration)}
            </div>
          )}

        {/* ── Call status overlay (connecting / ringing / connecting_media / ended) */}
        <CallStatusOverlay
          callStatus={callStatus}
          callType={callType}
          callDuration={callDuration}
          formatDuration={formatDuration}
          isIncoming={isIncoming}
          decodedCallerName={decodedCallerName}
          decodedRecipientName={decodedRecipientName}
          decodedCallerAvatarUrl={decodedCallerAvatarUrl}
          decodedRecipientAvatarUrl={decodedRecipientAvatarUrl}
          isScreenSharing={isLocalPresenting}
          remoteScreenShareStream={null}
          showConnectedGroupGallery={!!gridLayout && callStatus === 'connected'}
        />

        {/* ── Outgoing ringing: drop-call button ───────────────────────── */}
        {callStatus === 'ringing' && !isIncoming && (
          <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-6 sm:pb-8 mb-20 sm:mb-0 z-30 pointer-events-auto">
            <button
              onClick={handleEndCall}
              className="bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 active:scale-95 focus:outline-none"
              aria-label="Drop call"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
          </div>
        )}

        {/* ── Connected controls bar ───────────────────────────────────── */}
        {localId &&
          callType === 'video' &&
          callStatus === 'connected' &&
          localWebcamOn && (
            <LocalAdaptiveSendQuality participantId={localId} active />
          )}

        {callStatus === 'connected' && (
          <CallControls
            isMuted={isMuted}
            isVideoEnabled={isVideoEnabled}
            isScreenSharing={isLocalPresenting}
            remoteScreenShareStream={remoteScreenShareMarkerRef.current}
            screenShareParticipantName={presenterName}
            speakerLevel={speakerLevel}
            callType={callType}
            showMessageInput={showMessageInput}
            showAddPeople={showAddPeople}
            onToggleMute={handleToggleMic}
            onToggleVideo={handleToggleVideo}
            onToggleScreenShare={handleToggleScreenShare}
            onToggleSpeaker={handleToggleSpeaker}
            onToggleMessageInput={() => setShowMessageInput((p) => !p)}
            onToggleAddPeople={() => setShowAddPeople((p) => !p)}
            onEndCall={handleEndCall}
          />
        )}
      </div>

      {/* ── Add-people slide-over panel ───────────────────────────────────── */}
      {showAddPeople && (
        <AddPeoplePanel
          addPeopleSearch={addPeopleSearch}
          addPeopleResults={addPeopleResults}
          participants={Array.from(participants.values()).filter(
            (p: any) => p.id !== localId,
          )}
          inCallUserIds={inCallUserIds}
          busyByUserId={addPeopleBusyById}
          invitingUserId={invitingUserId}
          onSearchChange={setAddPeopleSearch}
          onClose={() => {
            setShowAddPeople(false);
            setAddPeopleSearch('');
            setAddPeopleBusyById({});
          }}
          onInvite={handleInviteToCall}
        />
      )}

      {/* ── In-call message input ─────────────────────────────────────────── */}
      {callStatus === 'connected' && showMessageInput && (
        <div className="p-2 sm:p-3 md:p-4">
          <MessageInput
            messageText={messageText}
            onMessageChange={setMessageText}
            onSend={handleSendMessage}
            onClose={() => { setShowMessageInput(false); setMessageText(''); }}
          />
        </div>
      )}
    </div>
  );
};

export default MeetingContainer;
