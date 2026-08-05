/**
 * Public API for the video/call module.
 */
export { default as CallModal, VideoSDKCallModal } from './CallModal';
export type { CallModalProps, VideoSDKCallModalProps } from './core/types';

export { default as MeetingContainer } from './providers/MeetingContainer';
export type { MeetingContainerProps } from './providers/videosdk/MeetingContainer';

export { resolveActiveProvider, resolveClientVideoProvider } from './providers';
export type { CallMediaProviderName } from './providers';

export type {
  NormalizedParticipant,
  NormalizedMeeting,
  CallStatus,
  CallType,
} from './core/models';

export type { CallMediaProviderAdapter } from './core/interfaces/CallMediaProvider';

export { playRingtone, stopRingtone, stopAll as stopAllRingtones } from './services/ringtoneService';
