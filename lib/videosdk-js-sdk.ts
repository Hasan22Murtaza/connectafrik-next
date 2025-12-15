// Lightweight stub for @videosdk.live/js-sdk to keep builds working without the package.
// Only the small surface used in VideoSDKCallModal is implemented.

type MeetingHandler = (...args: any[]) => void

class MockMeeting {
  private handlers: Record<string, MeetingHandler[]> = {}

  constructor(private readonly options: Record<string, any>) {}

  on(event: string, handler: MeetingHandler) {
    if (!this.handlers[event]) {
      this.handlers[event] = []
    }
    this.handlers[event].push(handler)
  }

  async join() {
    // Immediately invoke meeting-joined to mimic the SDK behaviour
    this.handlers['meeting-joined']?.forEach((cb) => {
      try {
        cb()
      } catch {
        /* ignore */
      }
    })
  }

  leave() {
    this.handlers['meeting-left']?.forEach((cb) => {
      try {
        cb()
      } catch {
        /* ignore */
      }
    })
  }
}

export const VideoSDK = {
  config: (_token: string) => {
    // no-op for stub
  },
  initMeeting: (options: Record<string, any>) => new MockMeeting(options),
}

