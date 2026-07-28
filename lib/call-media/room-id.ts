import { randomUUID } from 'crypto';

/** Shared room id format for LiveKit and VideoSDK. */
export function generateCallRoomId(): string {
  return randomUUID();
}
