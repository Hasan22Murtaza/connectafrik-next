/**
 * Listens for remote terminal call events while the callee is still in the pre-join
 * incoming ring phase (before media token / room join).
 *
 * Covers caller cancel (missed), remote end, and cross-device scenarios so the
 * incoming UI does not stay stuck ringing.
 */
'use client';

import { useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  callSessionRowToPollTerminalMessage,
  toCallSessionStatusMessageType,
} from '@/features/chat/services/callSessionRealtime';
import { supabaseMessagingService } from '@/features/chat/services/supabaseMessagingService';

export interface UseIncomingCallTerminalSignalsOptions {
  enabled: boolean;
  threadId?: string;
  callId?: string;
  currentUserId?: string;
  onTerminal: (reason: 'declined' | 'missed' | 'ended' | 'failed') => void;
}

function normalizeSignalMeta(rawMeta: unknown): Record<string, unknown> {
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
}

export function useIncomingCallTerminalSignals({
  enabled,
  threadId,
  callId,
  currentUserId,
  onTerminal,
}: UseIncomingCallTerminalSignalsOptions) {
  const onTerminalRef = useRef(onTerminal);
  onTerminalRef.current = onTerminal;
  const handledRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      handledRef.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !threadId) return;

    const activeCallId = (callId || '').trim();

    const shouldHandle = (msg: {
      thread_id?: string;
      sender_id?: string;
      metadata?: Record<string, unknown>;
    }): boolean => {
      if (msg.thread_id && msg.thread_id !== threadId) return false;
      if (msg.sender_id && currentUserId && msg.sender_id === currentUserId) return false;
      const meta = normalizeSignalMeta(msg.metadata);
      if (activeCallId && meta.callId && String(meta.callId) !== activeCallId) return false;
      return true;
    };

    const fireTerminal = (reason: 'declined' | 'missed' | 'ended' | 'failed') => {
      if (handledRef.current) return;
      handledRef.current = true;
      onTerminalRef.current(reason);
    };

    const handleTerminalMessage = (msg: {
      message_type?: string;
      thread_id?: string;
      sender_id?: string;
      metadata?: Record<string, unknown>;
    }) => {
      if (!shouldHandle(msg)) return;
      const statusType = toCallSessionStatusMessageType(String(msg.message_type || ''));
      if (statusType === 'declined') fireTerminal('declined');
      else if (statusType === 'missed') fireTerminal('missed');
      else if (statusType === 'ended') fireTerminal('ended');
      else if (statusType === 'failed') fireTerminal('failed');
    };

    const unsub = supabaseMessagingService.subscribeToCallSignals(threadId, handleTerminalMessage);

    let cancelled = false;
    const poll = async () => {
      if (!activeCallId) return;
      try {
        const res = await apiClient.get<{ session: Record<string, unknown> | null }>(
          `/api/chat/threads/${threadId}/call-sessions`,
          { call_id: activeCallId },
        );
        if (cancelled || handledRef.current) return;
        const session = res?.session;
        if (!session) return;
        const sessionStatus = String(session.status || '');
        if (!['ended', 'declined', 'missed', 'failed'].includes(sessionStatus)) return;
        const latest = callSessionRowToPollTerminalMessage(session);
        if (latest && shouldHandle(latest)) {
          handleTerminalMessage(latest);
        }
      } catch {
        /* ignore */
      }
    };

    const interval = setInterval(poll, 4000);
    const initial = setTimeout(poll, 1500);

    const handleFcm = (event: Event) => {
      const detail = (event as CustomEvent<{ data?: Record<string, string> }>).detail;
      const data = detail?.data;
      if (!data || typeof data !== 'object') return;
      const t = String(data.type || data.status || data.call_status || '')
        .trim()
        .toLowerCase();
      const last = String(data.last_signal || '').trim().toLowerCase();
      const tid = String(data.thread_id || data.threadId || '').trim();
      if (tid && tid !== threadId) return;
      const cidRaw = data.call_id || data.callId || '';
      const cid = typeof cidRaw === 'string' ? cidRaw.trim() : '';
      if (activeCallId && cid && cid !== activeCallId) return;

      if (t === 'declined' || last === 'declined') fireTerminal('declined');
      else if (t === 'missed' || last === 'missed') fireTerminal('missed');
      else if (t === 'ended' || last === 'ended') fireTerminal('ended');
      else if (t === 'failed' || last === 'failed') fireTerminal('failed');
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.type !== 'CALL_STATUS' || data.status !== 'ended') return;
      if (data.threadId && String(data.threadId) !== threadId) return;
      const pcid = typeof data.callId === 'string' ? data.callId.trim() : '';
      if (activeCallId && pcid && pcid !== activeCallId) return;
      fireTerminal('ended');
    };

    window.addEventListener('fcm-foreground-message', handleFcm);
    window.addEventListener('message', handleMessage);
    if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', handleMessage);
    }

    return () => {
      cancelled = true;
      unsub();
      clearInterval(interval);
      clearTimeout(initial);
      window.removeEventListener('fcm-foreground-message', handleFcm);
      window.removeEventListener('message', handleMessage);
      if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      }
    };
  }, [enabled, threadId, callId, currentUserId]);
}
