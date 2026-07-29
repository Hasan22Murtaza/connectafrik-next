import type { NormalizedParticipant } from '../models';
import type { ConnectionQuality } from '../models';

export type MeetingEventMap = {
  participantJoined: { participant: NormalizedParticipant };
  participantLeft: { participantId: string };
  participantUpdated: { participant: NormalizedParticipant };
  activeSpeakerChanged: { participantId: string | null };
  screenShareStarted: { participantId: string; presenterName: string };
  screenShareStopped: { participantId: string | null };
  messageReceived: { content: string; senderId: string };
  callConnected: Record<string, never>;
  callDisconnected: { reason?: string };
  recordingStarted: Record<string, never>;
  recordingStopped: Record<string, never>;
  connectionQualityChanged: {
    participantId: string;
    quality: ConnectionQuality;
  };
  error: { message: string; code?: string };
};

export type MeetingEventName = keyof MeetingEventMap;

export type MeetingEventHandler<E extends MeetingEventName> = (
  payload: MeetingEventMap[E],
) => void;

export type Unsubscribe = () => void;

export interface MeetingEventBus {
  on<E extends MeetingEventName>(
    event: E,
    handler: MeetingEventHandler<E>,
  ): Unsubscribe;
  emit<E extends MeetingEventName>(event: E, payload: MeetingEventMap[E]): void;
}

export function createMeetingEventBus(): MeetingEventBus {
  const listeners = new Map<MeetingEventName, Set<MeetingEventHandler<MeetingEventName>>>();

  return {
    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(handler as MeetingEventHandler<MeetingEventName>);
      return () => listeners.get(event)?.delete(handler as MeetingEventHandler<MeetingEventName>);
    },
    emit(event, payload) {
      listeners.get(event)?.forEach((h) => {
        try {
          h(payload);
        } catch {
          /* ignore listener errors */
        }
      });
    },
  };
}
