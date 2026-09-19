/** In-call raise-hand + live reactions — ephemeral, no backend schema change. */

export const CALL_ENGAGEMENT_TOPIC = 'ca.engagement';

export const CALL_LIVE_REACTIONS = [
  { emoji: '👍', label: 'Like' },
  { emoji: '❤️', label: 'Love' },
  { emoji: '😂', label: 'Laugh' },
  { emoji: '👏', label: 'Applause' },
  { emoji: '😮', label: 'Wow' },
  { emoji: '🎉', label: 'Celebration' },
] as const;

export type CallLiveReactionEmoji = (typeof CALL_LIVE_REACTIONS)[number]['emoji'];

export type CallEngagementPayload =
  | { v: 1; t: 'hand'; raised: boolean; id: string; name: string }
  | { v: 1; t: 'hand-req' }
  | { v: 1; t: 'rx'; emoji: string; id: string; name: string; k: string }
  | { v: 1; t: 'mute'; id: string; name: string };

export interface RaisedHandEntry {
  id: string;
  name: string;
}

export interface LiveCallReaction {
  key: string;
  emoji: string;
  participantId: string;
  name: string;
  createdAt: number;
  offsetX: number;
}

export function decodeCallEngagement(raw: string): CallEngagementPayload | null {
  try {
    const p = JSON.parse(raw) as CallEngagementPayload;
    if (!p || p.v !== 1) return null;
    if (p.t === 'hand' && typeof p.raised === 'boolean' && typeof p.id === 'string') return p;
    if (p.t === 'hand-req') return p;
    if (p.t === 'rx' && typeof p.emoji === 'string' && typeof p.id === 'string' && typeof p.k === 'string') {
      return p;
    }
    if (p.t === 'mute' && typeof p.id === 'string') return p;
    return null;
  } catch {
    return null;
  }
}

export function isAllowedLiveReaction(emoji: string): boolean {
  return CALL_LIVE_REACTIONS.some((r) => r.emoji === emoji);
}

export function newReactionKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeEngagementId(id: string | undefined | null): string {
  return (id || '').trim().toLowerCase();
}
