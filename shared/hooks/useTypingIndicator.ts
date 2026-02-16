"use client";

import { supabase } from "@/lib/supabase";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hook to manage typing indicators for a chat thread using Supabase Broadcast.
 *
 * Uses Broadcast channels (no database round-trip, no RLS needed).
 * - Broadcasts the current user's typing state to the thread channel.
 * - Listens for other users' typing events on the same channel.
 * - Auto-stops typing after TYPING_TIMEOUT_MS of inactivity.
 * - Cleans up stale indicators automatically.
 */
export function useTypingIndicator(
  threadId: string | null,
  currentUserId: string | null
) {
  const TYPING_TIMEOUT_MS = 3_000; // stop typing after 3s of no keystrokes
  const STALE_CLEANUP_MS = 4_000; // remove stale users after 4s with no event

  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const channelRef = useRef<any>(null);
  // Track last event time per user to clean up stale entries
  const lastSeenRef = useRef<Map<string, number>>(new Map());
  const cleanupIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---------- broadcast own typing state ----------
  const broadcastTyping = useCallback(
    (isTyping: boolean) => {
      if (!channelRef.current || !currentUserId) return;
      channelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: { user_id: currentUserId, is_typing: isTyping },
      });
    },
    [currentUserId]
  );

  /** Call on every keystroke in the message input */
  const handleTyping = useCallback(() => {
    if (!threadId || !currentUserId) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      broadcastTyping(true);
    }

    // Reset inactivity timer
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      broadcastTyping(false);
    }, TYPING_TIMEOUT_MS);
  }, [threadId, currentUserId, broadcastTyping]);

  /** Immediately stop typing (e.g. on send) */
  const stopTyping = useCallback(() => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (isTypingRef.current) {
      isTypingRef.current = false;
      broadcastTyping(false);
    }
  }, [broadcastTyping]);

  // ---------- subscribe to broadcast channel ----------
  useEffect(() => {
    if (!threadId || !currentUserId) return;

    const channel = supabase.channel(`typing:${threadId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "typing" }, (msg: any) => {
        const { user_id, is_typing } = msg.payload ?? {};
        if (!user_id || user_id === currentUserId) return;

        if (is_typing) {
          lastSeenRef.current.set(user_id, Date.now());
          setTypingUserIds((prev) =>
            prev.includes(user_id) ? prev : [...prev, user_id]
          );
        } else {
          lastSeenRef.current.delete(user_id);
          setTypingUserIds((prev) => prev.filter((id) => id !== user_id));
        }
      })
      .subscribe();

    channelRef.current = channel;

    // Periodic cleanup of stale typing indicators
    cleanupIntervalRef.current = setInterval(() => {
      const now = Date.now();
      let changed = false;
      lastSeenRef.current.forEach((ts, uid) => {
        if (now - ts > STALE_CLEANUP_MS) {
          lastSeenRef.current.delete(uid);
          changed = true;
        }
      });
      if (changed) {
        const activeIds = Array.from(lastSeenRef.current.keys());
        setTypingUserIds(activeIds);
      }
    }, 2_000);

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      lastSeenRef.current.clear();
      setTypingUserIds([]);
      if (cleanupIntervalRef.current) clearInterval(cleanupIntervalRef.current);
    };
  }, [threadId, currentUserId]);

  // ---------- cleanup on unmount ----------
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      // Broadcast stop-typing before leaving
      if (isTypingRef.current && channelRef.current && currentUserId) {
        channelRef.current.send({
          type: "broadcast",
          event: "typing",
          payload: { user_id: currentUserId, is_typing: false },
        });
        isTypingRef.current = false;
      }
    };
  }, [currentUserId]);

  return {
    /** IDs of other users currently typing in this thread */
    typingUserIds,
    /** Call on every keystroke */
    handleTyping,
    /** Call when sending a message or clearing the draft */
    stopTyping,
  };
}
