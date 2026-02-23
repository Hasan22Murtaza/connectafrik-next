/**
 * Engagement Tracking Service
 * Logs user interactions for the recommendation engine
 */

import { apiClient } from '@/lib/api-client'

interface EventData {
  userId: string
  postId: string
  type: 'view' | 'like' | 'comment' | 'share' | 'save' | 'watch'
  contentType?: 'post' | 'reel'
  dwellMs?: number
  percentViewed?: number
}

export async function logEngagementEvent(event: EventData): Promise<void> {
  try {
    await apiClient.post('/api/engagement', {
      post_id: event.postId,
      event_type: event.type,
      content_type: event.contentType ?? 'post',
      dwell_ms: event.dwellMs ?? null,
      percent_viewed: event.percentViewed ?? null,
    })
  } catch (e) {
    console.error('Failed to log engagement event:', e)
  }
}

/**
 * Dwell Time Tracker
 * Tracks how long a user views a post
 *
 * Usage:
 * const tracker = new DwellTimeTracker(postId, userId)
 * tracker.start()
 * // ... when post unmounts
 * tracker.cleanup()
 */
export class DwellTimeTracker {
  private startTime: number = 0
  private postId: string
  private userId: string
  private logged: boolean = false
  private minDwellMs: number = 1000 // Minimum 1 second to count as a view

  constructor(postId: string, userId: string, minDwellMs: number = 1000) {
    this.postId = postId
    this.userId = userId
    this.minDwellMs = minDwellMs
  }

  /**
   * Start tracking dwell time
   */
  start(): void {
    this.startTime = Date.now()
  }

  /**
   * Get current dwell time in milliseconds
   */
  getDwellTime(): number {
    return Date.now() - this.startTime
  }

  /**
   * Log view event with dwell time
   * Only logs if user spent at least minDwellMs
   */
  async logView(): Promise<void> {
    if (this.logged) return

    const dwellMs = this.getDwellTime()

    // Only log if user spent enough time (prevent accidental scrolls)
    if (dwellMs >= this.minDwellMs) {
      await logEngagementEvent({
        userId: this.userId,
        postId: this.postId,
        type: 'view',
        dwellMs
      })
      this.logged = true
    }
  }

  /**
   * Cleanup - call when component unmounts
   * Logs view if not already logged
   */
  async cleanup(): Promise<void> {
    await this.logView()
  }
}

/**
 * Video Watch Tracker
 * Tracks video/reel watch progress
 *
 * Usage:
 * const tracker = new VideoWatchTracker(postId, userId, videoDuration)
 * // On video progress update
 * tracker.updateProgress(currentTime)
 * // When video ends or component unmounts
 * tracker.cleanup(currentTime)
 */
export class VideoWatchTracker {
  private postId: string
  private userId: string
  private videoDuration: number
  private contentType: 'post' | 'reel'
  private logged: boolean = false
  private lastProgress: number = 0

  constructor(postId: string, userId: string, videoDuration: number, contentType: 'post' | 'reel' = 'post') {
    this.postId = postId
    this.userId = userId
    this.videoDuration = videoDuration
    this.contentType = contentType
  }

  /**
   * Update watch progress
   * Logs when user reaches 50% or completes video
   */
  async updateProgress(currentTime: number): Promise<void> {
    if (this.logged || this.videoDuration <= 0) return

    this.lastProgress = currentTime
    const percentViewed = Math.min(currentTime / this.videoDuration, 1.0)

    // Log when user reaches 50% milestone
    if (percentViewed >= 0.5) {
      await logEngagementEvent({
        userId: this.userId,
        postId: this.postId,
        type: 'watch',
        percentViewed,
        contentType: this.contentType
      })
      this.logged = true
    }
  }

  /**
   * Cleanup - call when video ends or component unmounts
   * Logs watch event if user watched at least 10%
   */
  async cleanup(currentTime?: number): Promise<void> {
    if (this.logged || this.videoDuration <= 0) return

    const finalTime = currentTime ?? this.lastProgress
    const percentViewed = Math.min(finalTime / this.videoDuration, 1.0)

    // Log if user watched at least 10% (shows some interest)
    if (percentViewed >= 0.1) {
      await logEngagementEvent({
        userId: this.userId,
        postId: this.postId,
        type: 'watch',
        percentViewed,
        contentType: this.contentType
      })
      this.logged = true
    }
  }
}

/**
 * Batch Event Logger
 * For logging multiple events efficiently
 * Useful for bulk operations or offline sync
 */
export class BatchEventLogger {
  private events: EventData[] = []
  private batchSize: number = 10
  private flushInterval: number = 5000 // 5 seconds

  constructor(batchSize: number = 10, flushIntervalMs: number = 5000) {
    this.batchSize = batchSize
    this.flushInterval = flushIntervalMs

    // Auto-flush on interval
    setInterval(() => this.flush(), this.flushInterval)
  }

  /**
   * Add event to batch
   */
  add(event: EventData): void {
    this.events.push(event)

    // Auto-flush when batch is full
    if (this.events.length >= this.batchSize) {
      this.flush()
    }
  }

  /**
   * Flush all pending events to database
   */
  async flush(): Promise<void> {
    if (this.events.length === 0) return

    const batch = [...this.events]
    this.events = []

    try {
      await apiClient.post('/api/engagement', {
        events: batch.map(e => ({
          post_id: e.postId,
          event_type: e.type,
          content_type: e.contentType ?? 'post',
          dwell_ms: e.dwellMs ?? null,
          percent_viewed: e.percentViewed ?? null,
        }))
      })
    } catch (e) {
      console.error('Failed to flush event batch:', e)
      this.events.push(...batch)
    }
  }

  /**
   * Cleanup - flush remaining events
   */
  async cleanup(): Promise<void> {
    await this.flush()
  }
}

/**
 * Hook-friendly wrapper for React components
 * Auto-tracks view and provides event logging functions
 */
export function useEngagementTracking(postId: string, userId: string) {
  const tracker = new DwellTimeTracker(postId, userId)

  // Start tracking immediately
  tracker.start()

  return {
    // Log view when component unmounts
    cleanup: () => tracker.cleanup(),

    // Manual event logging
    logLike: () => logEngagementEvent({ userId, postId, type: 'like' }),
    logComment: () => logEngagementEvent({ userId, postId, type: 'comment' }),
    logShare: () => logEngagementEvent({ userId, postId, type: 'share' }),
    logSave: () => logEngagementEvent({ userId, postId, type: 'save' }),

    // Get current dwell time (for debugging)
    getDwellTime: () => tracker.getDwellTime()
  }
}

/**
 * Utility: Log engagement event with error handling
 * Use this for simple one-off event logging
 */
export const trackEvent = {
  view: (userId: string, postId: string, dwellMs?: number, contentType: 'post' | 'reel' = 'post') =>
    logEngagementEvent({ userId, postId, type: 'view', dwellMs, contentType }),

  like: (userId: string, postId: string, contentType: 'post' | 'reel' = 'post') =>
    logEngagementEvent({ userId, postId, type: 'like', contentType }),

  comment: (userId: string, postId: string, contentType: 'post' | 'reel' = 'post') =>
    logEngagementEvent({ userId, postId, type: 'comment', contentType }),

  share: (userId: string, postId: string, contentType: 'post' | 'reel' = 'post') =>
    logEngagementEvent({ userId, postId, type: 'share', contentType }),

  save: (userId: string, postId: string, contentType: 'post' | 'reel' = 'post') =>
    logEngagementEvent({ userId, postId, type: 'save', contentType }),

  watch: (userId: string, postId: string, percentViewed: number, contentType: 'post' | 'reel' = 'post') =>
    logEngagementEvent({ userId, postId, type: 'watch', percentViewed, contentType })
}

export default {
  logEngagementEvent,
  DwellTimeTracker,
  VideoWatchTracker,
  BatchEventLogger,
  useEngagementTracking,
  trackEvent
}
