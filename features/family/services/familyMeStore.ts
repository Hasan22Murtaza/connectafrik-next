/**
 * Shared /api/family/me status — ScreenTimeGate + useParentalControls must not
 * each poll independently (especially visible during long calls).
 */
import {
  familyService,
  type FamilyMeStatus,
} from '@/features/settings/services/familyService'

type Listener = (me: FamilyMeStatus | null, loading: boolean) => void

let userId: string | null = null
let me: FamilyMeStatus | null = null
let loading = false
let inflight: Promise<void> | null = null
let statusTimer: ReturnType<typeof setInterval> | null = null
const listeners = new Set<Listener>()

const STATUS_POLL_MS = 45_000

function emit() {
  for (const listener of listeners) listener(me, loading)
}

async function load(force = false) {
  if (!userId) {
    me = null
    loading = false
    emit()
    return
  }
  if (!force && inflight) {
    await inflight
    return
  }

  loading = true
  emit()

  inflight = (async () => {
    try {
      const status = await familyService.getMe()
      if (!userId) return
      me = status
    } catch {
      /* non-fatal */
    } finally {
      loading = false
      emit()
      inflight = null
    }
  })()

  await inflight
}

function ensureStatusPoller() {
  if (statusTimer || !userId) return
  // Only keep a background poller while controls are active for this user.
  if (!me?.controls_active) return
  statusTimer = setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    void load(true)
  }, STATUS_POLL_MS)
}

function stopStatusPoller() {
  if (!statusTimer) return
  clearInterval(statusTimer)
  statusTimer = null
}

export const familyMeStore = {
  getMe() {
    return me
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    listener(me, loading)
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) {
        stopStatusPoller()
      }
    }
  },

  setUser(nextUserId: string | null) {
    if (userId === nextUserId) return
    stopStatusPoller()
    userId = nextUserId
    me = null
    if (!nextUserId) {
      loading = false
      emit()
      return
    }
    void load().then(() => ensureStatusPoller())
  },

  async refresh() {
    await load(true)
    stopStatusPoller()
    ensureStatusPoller()
  },
}
