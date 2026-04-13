// ─── VideoSDK React SDK components (new — use these) ─────────────────────────
export { default as ParticipantTile } from './ParticipantTile';
export { default as ScreenShareView } from './ScreenShareView';
export { default as MeetingContainer } from './MeetingContainer';
export type { ParticipantTileProps } from './ParticipantTile';
export type { ScreenShareViewProps } from './ScreenShareView';
export type { MeetingContainerProps } from './MeetingContainer';

// ─── Shared presentational components (used by both old and new stacks) ───────
export { default as CallStatusOverlay } from './CallStatusOverlay';
export { default as IncomingCallControls } from './IncomingCallControls';
export { default as CallControls } from './CallControls';
export { default as AddPeoplePanel } from './AddPeoplePanel';
export { default as MessageInput } from './MessageInput';

// ─── Legacy presentational components (no longer used by the active stack) ────
// These are kept temporarily to avoid breaking any page that may still import
// them by name. They will be deleted in the next cleanup pass.
// @deprecated — use ParticipantTile instead
export { default as ParticipantVideo } from './ParticipantVideo';
// @deprecated — use ScreenShareView instead
export { default as ScreenShareVideo } from './ScreenShareVideo';
// @deprecated — use ScreenShareView instead
export { default as ScreenShareOverlay } from './ScreenShareOverlay';

// ─── Shared types ─────────────────────────────────────────────────────────────
export type { VideoSDKCallModalProps, CallStatus, SpeakerLevel } from './types';
