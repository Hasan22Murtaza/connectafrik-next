// Minimal no-op manager used as a fallback in VideoSDKCallModal.
// Provides the hooks expected by the component without requiring the real SDK.

export const videoSDKWebRTCManager = {
  leaveMeeting: () => {},
  setLocalStream: (_stream: MediaStream | null) => {},
  toggleMic: () => {},
  toggleWebcam: () => {},
}

