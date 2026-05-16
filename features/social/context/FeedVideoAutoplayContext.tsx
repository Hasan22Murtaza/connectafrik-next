'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react'

const MIN_VISIBLE_RATIO = 0.55
const INTERSECTION_THRESHOLDS = [0, 0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1]

type VideoEntry = {
  video: HTMLVideoElement
  container: HTMLElement
  userUnmuted: boolean
}

function createAutoplayController() {
  const entries = new Map<string, VideoEntry>()
  const ratios = new Map<string, number>()
  let activeId: string | null = null
  let observer: IntersectionObserver | null = null

  const pauseAll = () => {
    entries.forEach(({ video }) => {
      video.pause()
    })
    activeId = null
  }

  const playId = (id: string) => {
    if (activeId === id) return

    entries.forEach(({ video, userUnmuted }, entryId) => {
      if (entryId === id) {
        if (!userUnmuted) video.muted = true
        void video.play().catch(() => {})
      } else {
        video.pause()
        if (!userUnmuted) video.muted = true
      }
    })
    activeId = id
  }

  const pickActiveVideo = () => {
    let bestId: string | null = null
    let bestRatio = 0

    ratios.forEach((ratio, id) => {
      if (!entries.has(id)) return
      if (ratio > bestRatio) {
        bestRatio = ratio
        bestId = id
      }
    })

    if (bestId && bestRatio >= MIN_VISIBLE_RATIO) {
      playId(bestId)
    } else {
      pauseAll()
    }
  }

  const ensureObserver = () => {
    if (observer) return
    observer = new IntersectionObserver(
      (observed) => {
        observed.forEach((entry) => {
          const id = (entry.target as HTMLElement).dataset.feedVideoId
          if (id) ratios.set(id, entry.intersectionRatio)
        })
        pickActiveVideo()
      },
      { threshold: INTERSECTION_THRESHOLDS }
    )
  }

  return {
    register(id: string, video: HTMLVideoElement, container: HTMLElement) {
      ensureObserver()
      entries.set(id, { video, container, userUnmuted: false })
      container.dataset.feedVideoId = id
      observer!.observe(container)
      return () => {
        observer?.unobserve(container)
        delete container.dataset.feedVideoId
        entries.delete(id)
        ratios.delete(id)
        if (activeId === id) {
          activeId = null
          pickActiveVideo()
        }
      }
    },
    setUserUnmuted(id: string, unmuted: boolean) {
      const entry = entries.get(id)
      if (entry) entry.userUnmuted = unmuted
    },
    pauseAll,
    pickActiveVideo,
  }
}

type FeedVideoAutoplayContextValue = {
  registerVideo: (
    id: string,
    video: HTMLVideoElement,
    container: HTMLElement
  ) => () => void
  setUserUnmuted: (id: string, unmuted: boolean) => void
}

const FeedVideoAutoplayContext = createContext<FeedVideoAutoplayContextValue | null>(
  null
)

export function FeedVideoAutoplayProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const controllerRef = useRef(createAutoplayController())

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) {
        controllerRef.current.pauseAll()
      } else {
        controllerRef.current.pickActiveVideo()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  const registerVideo = useCallback(
    (id: string, video: HTMLVideoElement, container: HTMLElement) =>
      controllerRef.current.register(id, video, container),
    []
  )

  const setUserUnmuted = useCallback((id: string, unmuted: boolean) => {
    controllerRef.current.setUserUnmuted(id, unmuted)
  }, [])

  const value = useMemo(
    () => ({ registerVideo, setUserUnmuted }),
    [registerVideo, setUserUnmuted]
  )

  return (
    <FeedVideoAutoplayContext.Provider value={value}>
      {children}
    </FeedVideoAutoplayContext.Provider>
  )
}

export function useFeedVideoAutoplay() {
  return useContext(FeedVideoAutoplayContext)
}
