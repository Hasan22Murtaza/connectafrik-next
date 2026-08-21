'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import toast from 'react-hot-toast';
import { apiClient, ApiError } from '@/lib/api-client';
import { friendRequestService, type Friend } from '@/features/social/services/friendRequestService';
import { patchCallSessionWithRetry } from '@/features/chat/services/callSessionRealtime';
import type { CallInvitation } from '@/shared/types/callInvite';

export interface CallInvitePerson {
  id: string;
  full_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  status?: string | null;
}

interface UseCallInviteOptions {
  enabled: boolean;
  currentUserId?: string;
  originThreadId?: string;
  callId: string;
  callIdRef?: MutableRefObject<string>;
  roomId: string;
  callType: 'audio' | 'video';
  callerName: string;
  provider: 'livekit' | 'videosdk';
  inCallUserIds: string[];
}

function latestInvites(list: CallInvitation[]): CallInvitation[] {
  const sorted = [...list].sort(
    (a, b) => Date.parse(b.invited_at) - Date.parse(a.invited_at),
  );
  const map = new Map<string, CallInvitation>();
  for (const inv of sorted) {
    if (inv.user_id && !map.has(inv.user_id)) map.set(inv.user_id, inv);
  }
  return Array.from(map.values());
}

function inviteErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const msg = err.message || '';
    if (/already been invited/i.test(msg)) return 'This person has already been invited.';
    if (/already in the call/i.test(msg)) return 'This person is already in the call.';
    if (/another call/i.test(msg)) return 'This person is already in another call.';
    if (/friends/i.test(msg)) return 'You can only invite friends to a call.';
    if (msg) return msg;
  }
  if (err instanceof Error && err.message) return err.message;
  return 'Could not add this person to the call.';
}

export function useCallInvite({
  enabled,
  currentUserId,
  originThreadId,
  callId,
  callIdRef,
  roomId,
  callType,
  callerName,
  provider,
  inCallUserIds,
}: UseCallInviteOptions) {
  const [search, setSearch] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchResults, setSearchResults] = useState<CallInvitePerson[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [busyByUserId, setBusyByUserId] = useState<Record<string, boolean>>({});
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);
  const [cancellingUserId, setCancellingUserId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [invitations, setInvitations] = useState<CallInvitation[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshInvitations = useCallback(async () => {
    if (!originThreadId || !callId) return;
    try {
      const res = await apiClient.get<{ invitations?: CallInvitation[] }>(
        `/api/chat/threads/${originThreadId}/call-sessions`,
        { call_id: callId, include_participants: '1' },
      );
      if (mountedRef.current && Array.isArray(res?.invitations)) {
        setInvitations(latestInvites(res.invitations));
      }
    } catch {
      /* ignore */
    }
  }, [originThreadId, callId]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = async () => {
      setFriendsLoading(true);
      try {
        const list = await friendRequestService.getFriends();
        if (!cancelled && mountedRef.current) {
          setFriends(list.filter((f) => f.id !== currentUserId));
        }
      } catch {
        if (!cancelled && mountedRef.current) setFriends([]);
      } finally {
        if (!cancelled && mountedRef.current) setFriendsLoading(false);
      }
    };
    void load();
    void refreshInvitations();
    return () => {
      cancelled = true;
    };
  }, [enabled, currentUserId, refreshInvitations]);

  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => {
      void refreshInvitations();
    }, 4000);
    return () => clearInterval(interval);
  }, [enabled, refreshInvitations]);

  useEffect(() => {
    if (!enabled || search.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await apiClient.get<{ data: CallInvitePerson[] }>('/api/users/search', {
          q: search.trim(),
          limit: 20,
        });
        const rows = (res?.data || []).filter((u) => u.id && u.id !== currentUserId);
        const friendIds = new Set(friends.map((f) => f.id));
        if (mountedRef.current) {
          setSearchResults(rows.filter((u) => friendIds.has(u.id) || (u as { is_friend?: boolean }).is_friend));
        }
      } catch {
        if (mountedRef.current) setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [enabled, search, currentUserId, friends]);

  const visiblePeople = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length >= 2 && searchResults.length > 0) return searchResults;
    if (!q) return friends;
    return friends.filter(
      (f) =>
        (f.full_name || '').toLowerCase().includes(q) ||
        (f.username || '').toLowerCase().includes(q),
    );
  }, [search, searchResults, friends]);

  useEffect(() => {
    if (!enabled || visiblePeople.length === 0) {
      setBusyByUserId({});
      return;
    }
    let cancelled = false;
    const ids = visiblePeople.map((u) => u.id).filter(Boolean);
    const run = async () => {
      try {
        const exclude = (callIdRef?.current || callId).trim();
        const res = await apiClient.post<{ busy: Record<string, boolean> }>('/api/videosdk/room', {
          busy_check: true,
          user_ids: ids,
          ...(exclude ? { exclude_call_id: exclude } : {}),
        });
        if (!cancelled && res?.busy) setBusyByUserId(res.busy);
      } catch {
        if (!cancelled) setBusyByUserId({});
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [enabled, visiblePeople, callId]);

  const pendingByUserId = useMemo(() => {
    const map = new Map<string, CallInvitation>();
    for (const inv of invitations) {
      if (inv.user_id) map.set(inv.user_id, inv);
    }
    return map;
  }, [invitations]);

  const inviteOne = useCallback(
    async (targetUser: CallInvitePerson) => {
      if (!currentUserId || !targetUser.id || invitingUserId) return false;
      const exclude = (callIdRef?.current || callId).trim();
      try {
        const busyRes = await apiClient.post<{ busy: Record<string, boolean> }>('/api/videosdk/room', {
          busy_check: true,
          user_ids: [targetUser.id],
          ...(exclude ? { exclude_call_id: exclude } : {}),
        });
        if (busyRes.busy?.[targetUser.id]) {
          toast.error('This person is already in another call.');
          return false;
        }
      } catch {
        /* server invite is authoritative */
      }
      setInvitingUserId(targetUser.id);
      try {
        const threadRes = await apiClient.post<{ data: { id: string } }>('/api/chat/threads', {
          participant_ids: [targetUser.id],
          type: 'direct',
        });
        const directThreadId = threadRes?.data?.id;
        if (!directThreadId) throw new Error('Thread not found');
        await apiClient.post(`/api/chat/threads/${directThreadId}/call-sessions`, {
          call_id: callIdRef?.current || callId,
          call_type: callType,
          room_id: roomId,
          target_user_id: targetUser.id,
          is_group_call: true,
          caller_name: callerName,
          provider,
        });
        toast.success(`Invited ${targetUser.full_name || targetUser.username || 'user'}`);
        await refreshInvitations();
        return true;
      } catch (err) {
        toast.error(inviteErrorMessage(err));
        return false;
      } finally {
        if (mountedRef.current) setInvitingUserId(null);
      }
    },
    [currentUserId, invitingUserId, callId, callIdRef, callType, roomId, callerName, provider, refreshInvitations],
  );

  const inviteSelected = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    for (const id of ids) {
      const person = visiblePeople.find((p) => p.id === id) || friends.find((p) => p.id === id);
      if (!person) continue;
      const pending = pendingByUserId.get(id);
      if (pending?.status === 'pending' || inCallUserIds.includes(id)) continue;
      await inviteOne(person);
    }
    setSelectedIds(new Set());
  }, [selectedIds, visiblePeople, friends, pendingByUserId, inCallUserIds, inviteOne]);

  const cancelInvite = useCallback(
    async (invitation: CallInvitation) => {
      if (!invitation.thread_id || !callId || cancellingUserId) return;
      setCancellingUserId(invitation.user_id);
      try {
        const ok = await patchCallSessionWithRetry(invitation.thread_id, {
          call_id: (callIdRef?.current || callId).trim(),
          event: 'cancel_invite',
        });
        if (!ok) throw new Error('Could not cancel invitation');
        toast.success('Invitation cancelled');
        await refreshInvitations();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not cancel invitation');
      } finally {
        if (mountedRef.current) setCancellingUserId(null);
      }
    },
    [callId, callIdRef, cancellingUserId, refreshInvitations],
  );

  const toggleSelected = useCallback((userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setSearch('');
    setSearchResults([]);
    setSelectedIds(new Set());
    setBusyByUserId({});
  }, []);

  return {
    search,
    setSearch,
    visiblePeople,
    friendsLoading,
    busyByUserId,
    invitingUserId,
    cancellingUserId,
    selectedIds,
    toggleSelected,
    invitations,
    pendingByUserId,
    inviteOne,
    inviteSelected,
    cancelInvite,
    reset,
  };
}
