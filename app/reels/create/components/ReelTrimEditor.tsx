'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play } from '@/shared/icons'
import {
  extractFilmstrip,
  formatTrimTime,
  trimVideoFile,
  type CapturedReelMedia,
} from './reelMediaUtils'

type Props = {
  media: CapturedReelMedia
  onCancel: () => void
  onDone: (media: CapturedReelMedia) => void
}

const ACCENT = 'var(--african-orange)'
const MIN_TRIM = 0.5

export default function ReelTrimEditor({ media, onCancel, onDone }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const dragKind = useRef<'start' | 'end' | null>(null)

  const fullDuration = Math.max(media.duration || 0, 0.1)
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(fullDuration)
  const [frames, setFrames] = useState<string[]>([])
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)

  const selected = Math.max(end - start, 0)

  useEffect(() => {
    let cancelled = false
    void extractFilmstrip(media.preview, 10).then((f) => {
      if (!cancelled) setFrames(f)
    })
    return () => {
      cancelled = true
    }
  }, [media.preview])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = start
  }, [start])

  const togglePlay = useCallback(async () => {
    const v = videoRef.current
    if (!v) return
    if (playing) {
      v.pause()
      setPlaying(false)
      return
    }
    if (v.currentTime < start || v.currentTime >= end - 0.05) {
      v.currentTime = start
    }
    try {
      await v.play()
      setPlaying(true)
    } catch {
      setPlaying(false)
    }
  }, [playing, start, end])

  const onTimeUpdate = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.currentTime >= end) {
      v.pause()
      v.currentTime = start
      setPlaying(false)
    }
  }, [end, start])

  const reset = useCallback(() => {
    setStart(0)
    setEnd(fullDuration)
    const v = videoRef.current
    if (v) {
      v.pause()
      v.currentTime = 0
    }
    setPlaying(false)
  }, [fullDuration])

  const posToTime = useCallback(
    (clientX: number) => {
      const el = trackRef.current
      if (!el) return 0
      const rect = el.getBoundingClientRect()
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
      return ratio * fullDuration
    },
    [fullDuration]
  )

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragKind.current) return
      const t = posToTime(e.clientX)
      if (dragKind.current === 'start') {
        setStart(Math.min(t, end - MIN_TRIM))
      } else {
        setEnd(Math.max(t, start + MIN_TRIM))
      }
    },
    [end, posToTime, start]
  )

  const onPointerUp = useCallback(() => {
    dragKind.current = null
  }, [])

  useEffect(() => {
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [onPointerMove, onPointerUp])

  const startPct = useMemo(() => (start / fullDuration) * 100, [start, fullDuration])
  const endPct = useMemo(() => (end / fullDuration) * 100, [end, fullDuration])

  const handleDone = useCallback(async () => {
    if (busy) return
    setBusy(true)
    setProgress(0)
    try {
      const trimmed = await trimVideoFile(media, start, end, setProgress)
      onDone(trimmed)
    } catch (err) {
      console.error(err)
      onDone({
        ...media,
        duration: Math.round(selected) || media.duration,
      })
    } finally {
      setBusy(false)
    }
  }, [busy, media, onDone, selected, start, end])

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white">
      <div className="mx-auto flex h-full w-full max-w-[430px] flex-col">
        <header
          className="relative flex h-12 shrink-0 items-center justify-center px-4"
          style={{ marginTop: 'env(safe-area-inset-top)' }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[16px] font-semibold"
            style={{ color: ACCENT }}
          >
            Cancel
          </button>
          <h1 className="text-[17px] font-semibold">Trim video</h1>
          <button
            type="button"
            onClick={handleDone}
            disabled={busy}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[16px] font-semibold disabled:opacity-50"
            style={{ color: ACCENT }}
          >
            {busy ? `${Math.round(progress * 100)}%` : 'Done'}
          </button>
        </header>

        <div className="flex min-h-0 flex-1 items-center justify-center px-10 py-3">
          <div className="relative aspect-[9/16] h-full max-h-full w-auto max-w-full overflow-hidden rounded-lg bg-[#111]">
            <video
              ref={videoRef}
              src={media.preview}
              className="h-full w-full object-cover"
              playsInline
              muted={muted}
              onTimeUpdate={onTimeUpdate}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center px-4 py-2 text-[14px]">
          <button
            type="button"
            onClick={togglePlay}
            className="p-1"
            style={{ color: ACCENT }}
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
          </button>
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            className="ml-3 font-semibold"
            style={{ color: ACCENT }}
          >
            {muted ? 'Unmute' : 'Mute'}
          </button>
          <span className="flex-1 text-center text-[14px] text-white">
            {formatTrimTime(selected)} selected
          </span>
          <button
            type="button"
            onClick={reset}
            className="font-semibold"
            style={{ color: ACCENT }}
          >
            Reset
          </button>
        </div>

        <div
          className="shrink-0 px-4 pt-2"
          style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
        >
          <div ref={trackRef} className="relative h-[64px] select-none">
            <div className="absolute inset-0 flex overflow-hidden rounded-md bg-[#222]">
              {(frames.length ? frames : Array.from({ length: 10 })).map((src, i) =>
                typeof src === 'string' && src.startsWith('data:') ? (
                  <img key={i} src={src} alt="" className="h-full flex-1 object-cover" draggable={false} />
                ) : (
                  <div key={i} className="h-full flex-1 bg-[#2a2a2a]" />
                )
              )}
            </div>

            
            <div
              className="pointer-events-none absolute inset-y-0 left-0 bg-black/55"
              style={{ width: `${startPct}%` }}
            />
            <div
              className="pointer-events-none absolute inset-y-0 right-0 bg-black/55"
              style={{ width: `${100 - endPct}%` }}
            />

            
            <div
              className="absolute inset-y-0 rounded-md border-[3px]"
              style={{
                left: `${startPct}%`,
                width: `${Math.max(endPct - startPct, 2)}%`,
                borderColor: ACCENT,
              }}
            >
              <button
                type="button"
                aria-label="Trim start"
                className="absolute -left-[3px] top-0 bottom-0 w-4 touch-none rounded-l-md"
                style={{ backgroundColor: ACCENT }}
                onPointerDown={(e) => {
                  e.preventDefault()
                  dragKind.current = 'start'
                  ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
                }}
              >
                <span className="absolute left-1/2 top-1/2 h-6 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded bg-black/70" />
              </button>
              <button
                type="button"
                aria-label="Trim end"
                className="absolute -right-[3px] top-0 bottom-0 w-4 touch-none rounded-r-md"
                style={{ backgroundColor: ACCENT }}
                onPointerDown={(e) => {
                  e.preventDefault()
                  dragKind.current = 'end'
                  ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
                }}
              >
                <span className="absolute left-1/2 top-1/2 h-6 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded bg-black/70" />
              </button>
            </div>
          </div>

          <div className="mt-2 flex justify-between text-[12px] text-white/90">
            <span>Start {formatTrimTime(start)}</span>
            <span>End {formatTrimTime(end)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
