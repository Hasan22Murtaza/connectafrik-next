// Minimal no-op manager used as a fallback when the real VideoSDK WebRTC layer is unavailable.

export const videoSDKWebRTCManager = {
  leaveMeeting: () => {},
  setLocalStream: (_stream: MediaStream | null) => {},
  toggleMic: () => {},
  toggleWebcam: () => {},
};
