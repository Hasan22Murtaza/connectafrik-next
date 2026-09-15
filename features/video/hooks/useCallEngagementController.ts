'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  isAllowedLiveReaction,
  newReactionKey,
  normalizeEngagementId,
  type CallEngagementPayload,
  type LiveCallReaction,
  type RaisedHandEntry,
} from '@/features/video/core/callEngagement';

const REACTION_TTL_MS = 2600;
const MAX_LIVE_REACTIONS = 18;

export interface CallEngagementApi {
  handRaised: boolean;
  raisedHands: RaisedHandEntry[];
  isHandRaised: (participantId: string) => boolean;
  toggleHand: () => void;
  sendReaction: (emoji: string) => void;
  liveReactions: LiveCallReaction[];
}

export function useCallEngagementController(
  selfId: string,
  selfName: string,
  activeIds: string[],
) {
  const selfKey = normalizeEngagementId(selfId);
  const [raisedById, setRaisedById] = useState<Map<string, string>>(() => new Map());
  const [liveReactions, setLiveReactions] = useState<LiveCallReaction[]>([]);
  const publishRef = useRef<(payload: CallEngagementPayload) => void>(() => {});
  const selfNameRef = useRef(selfName);
  selfNameRef.current = selfName;
  const raisedByIdRef = useRef(raisedById);
  raisedByIdRef.current = raisedById;

  const attachPublish = useCallback((fn: (payload: CallEngagementPayload) => void) => {
    publishRef.current = fn;
  }, []);

  const applyIncoming = useCallback((payload: CallEngagementPayload, senderId?: string) => {
    if (payload.t === 'hand-req') {
      const key = normalizeEngagementId(selfId);
      if (key && raisedByIdRef.current.has(key)) {
        publishRef.current({
          v: 1,
          t: 'hand',
          raised: true,
          id: key,
          name: selfNameRef.current || 'You',
        });
      }
      return;
    }

    if (payload.t === 'hand') {
      const id = normalizeEngagementId(payload.id || senderId);
      if (!id) return;
      setRaisedById((prev) => {
        const next = new Map(prev);
        if (payload.raised) next.set(id, payload.name || 'Participant');
        else next.delete(id);
        return next;
      });
      return;
    }

    if (payload.t === 'rx' && isAllowedLiveReaction(payload.emoji)) {
      const id = normalizeEngagementId(payload.id || senderId);
      const entry: LiveCallReaction = {
        key: payload.k,
        emoji: payload.emoji,
        participantId: id,
        name: payload.name || 'Participant',
        createdAt: Date.now(),
        offsetX: Math.round((Math.random() - 0.5) * 220),
      };
      setLiveReactions((prev) => {
        if (prev.some((r) => r.key === entry.key)) return prev;
        return [...prev, entry].slice(-MAX_LIVE_REACTIONS);
      });
    }
  }, [selfId]);

  useEffect(() => {
    const allowed = new Set(activeIds.map(normalizeEngagementId).filter(Boolean));
    if (selfKey) allowed.add(selfKey);
    setRaisedById((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const id of next.keys()) {
        if (!allowed.has(id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [activeIds, selfKey]);

  useEffect(() => {
    if (liveReactions.length === 0) return;
    const timer = window.setTimeout(() => {
      const cutoff = Date.now() - REACTION_TTL_MS;
      setLiveReactions((prev) => prev.filter((r) => r.createdAt > cutoff));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [liveReactions]);

  const toggleHand = useCallback(() => {
    if (!selfKey) return;
    const nextRaised = !raisedByIdRef.current.has(selfKey);
    const name = selfNameRef.current || 'You';
    setRaisedById((prev) => {
      const map = new Map(prev);
      if (nextRaised) map.set(selfKey, name);
      else map.delete(selfKey);
      return map;
    });
    publishRef.current({ v: 1, t: 'hand', raised: nextRaised, id: selfKey, name });
  }, [selfKey]);

  const sendReaction = useCallback(
    (emoji: string) => {
      if (!selfKey || !isAllowedLiveReaction(emoji)) return;
      const k = newReactionKey();
      const name = selfNameRef.current || 'You';
      applyIncoming({ v: 1, t: 'rx', emoji, id: selfKey, name, k });
      publishRef.current({ v: 1, t: 'rx', emoji, id: selfKey, name, k });
    },
    [applyIncoming, selfKey],
  );

  const isHandRaised = useCallback(
    (participantId: string) => raisedById.has(normalizeEngagementId(participantId)),
    [raisedById],
  );

  const raisedHands = useMemo<RaisedHandEntry[]>(
    () =>
      Array.from(raisedById.entries()).map(([id, name]) => ({
        id,
        name: id === selfKey ? 'You' : name,
      })),
    [raisedById, selfKey],
  );

  return {
    api: {
      handRaised: selfKey ? raisedById.has(selfKey) : false,
      raisedHands,
      isHandRaised,
      toggleHand,
      sendReaction,
      liveReactions,
    } satisfies CallEngagementApi,
    attachPublish,
    applyIncoming,
  };
}
