'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { apiClient } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import type {
  OnboardingModule,
  OnboardingProgressRow,
  OnboardingStatus,
  ProgressMap,
  ScreenTourConfig,
} from './types'
import { resolveScreenTour } from './resolveScreen'
import {
  destroyActiveTour,
  hasBlockingWorkflow,
  runGuidedTour,
  type TourFinishReason,
} from './runTour'

type OnboardingContextValue = {
  module: OnboardingModule
  ready: boolean
  progress: ProgressMap
  isDone: (screenKey: string) => boolean
  markStatus: (screenKey: string, status: OnboardingStatus) => Promise<void>
  replayTour: (screenKey?: string) => void
  startTourForPath: (pathname: string, force?: boolean) => void
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null)

const cacheKey = (userId: string, module: OnboardingModule) =>
  `ca_onboarding_${module}_${userId}`

function rowsToMap(rows: OnboardingProgressRow[]): ProgressMap {
  const map: ProgressMap = {}
  for (const row of rows) {
    map[row.screen_key] = row.status
  }
  return map
}

function readLocalCache(userId: string, module: OnboardingModule): ProgressMap | null {
  try {
    const raw = localStorage.getItem(cacheKey(userId, module))
    if (!raw) return null
    return JSON.parse(raw) as ProgressMap
  } catch {
    return null
  }
}

function writeLocalCache(userId: string, module: OnboardingModule, map: ProgressMap) {
  try {
    localStorage.setItem(cacheKey(userId, module), JSON.stringify(map))
  } catch {
    /* ignore quota */
  }
}

export function OnboardingProvider({
  module,
  tours,
  children,
}: {
  module: OnboardingModule
  tours: ScreenTourConfig[]
  children: React.ReactNode
}) {
  const { user, loading: authLoading } = useAuth()
  const [progress, setProgress] = useState<ProgressMap>({})
  const [ready, setReady] = useState(false)
  const runningRef = useRef(false)
  const fetchedForUser = useRef<string | null>(null)

  // Fetch once per user+module; seed from localStorage for snappy UX
  useEffect(() => {
    if (authLoading) return
    if (!user?.id) {
      setProgress({})
      setReady(false)
      fetchedForUser.current = null
      destroyActiveTour()
      return
    }

    if (fetchedForUser.current === user.id) return
    fetchedForUser.current = user.id

    const cached = readLocalCache(user.id, module)
    if (cached) {
      setProgress(cached)
      setReady(true)
    }

    let cancelled = false
    ;(async () => {
      try {
        const rows = await apiClient.get<OnboardingProgressRow[]>(
          '/api/onboarding/progress',
          { module }
        )
        if (cancelled) return
        const map = rowsToMap(rows)
        setProgress(map)
        writeLocalCache(user.id, module, map)
      } catch {
        // Keep local cache if API fails (table may not be migrated yet)
        if (!cached) setProgress({})
      } finally {
        if (!cancelled) setReady(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [authLoading, user?.id, module])

  const isDone = useCallback(
    (screenKey: string) => {
      const status = progress[screenKey]
      return status === 'completed' || status === 'skipped'
    },
    [progress]
  )

  const markStatus = useCallback(
    async (screenKey: string, status: OnboardingStatus) => {
      if (!user?.id) return

      setProgress((prev) => {
        const next = { ...prev, [screenKey]: status }
        writeLocalCache(user.id, module, next)
        return next
      })

      try {
        await apiClient.patch('/api/onboarding/progress', {
          module,
          screen_key: screenKey,
          status,
        })
      } catch {
        /* optimistic local write already applied */
      }
    },
    [user?.id, module]
  )

  const launchTour = useCallback(
    async (tour: ScreenTourConfig, force: boolean) => {
      if (runningRef.current) return
      if (!force && isDone(tour.screenKey)) return
      if (hasBlockingWorkflow()) return

      runningRef.current = true
      try {
        await runGuidedTour({
          steps: tour.steps,
          onFinish: (reason: TourFinishReason) => {
            runningRef.current = false
            const status: OnboardingStatus =
              reason === 'completed' ? 'completed' : 'skipped'
            void markStatus(tour.screenKey, status)
          },
        })
      } catch {
        runningRef.current = false
      }
    },
    [isDone, markStatus]
  )

  const pendingTimer = useRef<number | null>(null)

  const startTourForPath = useCallback(
    (pathname: string, force = false) => {
      const tour = resolveScreenTour(pathname, tours)
      if (!tour) return
      if (pendingTimer.current) window.clearTimeout(pendingTimer.current)
      // Small delay so page panels finish first paint
      pendingTimer.current = window.setTimeout(() => {
        pendingTimer.current = null
        void launchTour(tour, force)
      }, force ? 150 : 600)
    },
    [tours, launchTour]
  )

  const replayTour = useCallback(
    (screenKey?: string) => {
      destroyActiveTour()
      runningRef.current = false

      const tour = screenKey
        ? tours.find((t) => t.screenKey === screenKey) ?? null
        : resolveScreenTour(
            typeof window !== 'undefined' ? window.location.pathname : '',
            tours
          )

      if (!tour) return

      void markStatus(tour.screenKey, 'not_started').then(() => {
        void launchTour(tour, true)
      })
    },
    [tours, markStatus, launchTour]
  )

  // Cleanup on unmount
  useEffect(() => () => destroyActiveTour(), [])

  const value = useMemo<OnboardingContextValue>(
    () => ({
      module,
      ready,
      progress,
      isDone,
      markStatus,
      replayTour,
      startTourForPath,
    }),
    [module, ready, progress, isDone, markStatus, replayTour, startTourForPath]
  )

  return (
    <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>
  )
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext)
  if (!ctx) {
    throw new Error('useOnboarding must be used within OnboardingProvider')
  }
  return ctx
}

/** Safe hook when provider may be absent (e.g. shared sidebar pieces). */
export function useOnboardingOptional() {
  return useContext(OnboardingContext)
}
