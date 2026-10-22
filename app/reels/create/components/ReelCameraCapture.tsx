'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Check, SwitchCamera, X } from '@/shared/icons'
import { MAX_REEL_DURATION } from '@/shared/types/reels'
import { makeThumbnail, type CapturedReelMedia } from './reelMediaUtils'

export type { CapturedReelMedia }

type Props = {
  onClose: () => void
  onCaptured: (media: CapturedReelMedia) => void
  onOpenGallery: () => void
}

type RecState = 'idle' | 'recording' | 'paused'

function GalleryGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M3.5 16.5 8 12l3.5 3.5L15 12l5.5 5.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16.5" cy="9" r="1.5" fill="currentColor" />
    </svg>
  )
}

export default function ReelCameraCapture({ onClose, onCaptured, onOpenGallery }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mimeRef = useRef('video/webm')
  const secondsRef = useRef(0)

  const [facing, setFacing] = useState<'user' | 'environment'>('user')
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [recState, setRecState] = useState<RecState>('idle')
  const [seconds, setSeconds] = useState(0)
  const [finalizing, setFinalizing] = useState(false)

  const clearTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current)
      tickRef.current = null
    }
  }, [])

  const stopCameraTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setReady(false)
  }, [])

  const hardCleanup = useCallback(() => {
    clearTick()
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') {
      try {
        rec.onstop = null
        rec.stop()
      } catch {
        /* no-op */
      }
    }
    recorderRef.current = null
    chunksRef.current = []
    stopCameraTracks()
    setRecState('idle')
    setSeconds(0)
    secondsRef.current = 0
  }, [clearTick, stopCameraTracks])

  const startCamera = useCallback(
    async (nextFacing: 'user' | 'environment') => {
      setError(null)
      if (recorderRef.current && recorderRef.current.state !== 'inactive') return

      streamRef.current?.getTracks().forEach((t) => t.stop())
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: {
            facingMode: { ideal: nextFacing },
            width: { ideal: 1080 },
            height: { ideal: 1920 },
          },
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setReady(true)
      } catch {
        setError('Camera access is required. You can still pick a video from your gallery.')
        setReady(false)
      }
    },
    []
  )

  useEffect(() => {
    void startCamera(facing)
    return () => hardCleanup()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const flipCamera = useCallback(() => {
    if (recState !== 'idle') return
    const next = facing === 'user' ? 'environment' : 'user'
    setFacing(next)
    void startCamera(next)
  }, [facing, recState, startCamera])

  const startTick = useCallback(() => {
    clearTick()
    tickRef.current = setInterval(() => {
      secondsRef.current += 1
      const next = secondsRef.current
      setSeconds(next)
      if (next >= MAX_REEL_DURATION) {
        const rec = recorderRef.current
        if (rec && rec.state !== 'inactive') rec.stop()
      }
    }, 1000)
  }, [clearTick])

  const finalizeFromChunks = useCallback(async () => {
    setFinalizing(true)
    clearTick()
    try {
      const blob = new Blob(chunksRef.current, { type: mimeRef.current })
      if (!blob.size) {
        setError('Recording was empty. Try again.')
        setRecState('idle')
        setSeconds(0)
        secondsRef.current = 0
        chunksRef.current = []
        recorderRef.current = null
        return
      }
      const file = new File([blob], `reel-${Date.now()}.webm`, { type: mimeRef.current })
      const preview = URL.createObjectURL(blob)
      const meta = await makeThumbnail(file, preview)
      stopCameraTracks()
      recorderRef.current = null
      chunksRef.current = []
      onCaptured({
        file,
        preview,
        duration: meta.duration || secondsRef.current,
        thumbnailUrl: meta.thumbnailUrl,
      })
    } finally {
      setFinalizing(false)
    }
  }, [clearTick, onCaptured, stopCameraTracks])

  const startRecording = useCallback(() => {
    const stream = streamRef.current
    if (!stream || !ready || recState !== 'idle') return

    chunksRef.current = []
    let mime = 'video/webm;codecs=vp9,opus'
    if (!MediaRecorder.isTypeSupported(mime)) {
      mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : 'video/webm'
    }
    mimeRef.current = mime

    try {
      const rec = new MediaRecorder(stream, { mimeType: mime })
      recorderRef.current = rec
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.onstop = () => {
        void finalizeFromChunks()
      }
      rec.start(250)
      secondsRef.current = 0
      setSeconds(0)
      setRecState('recording')
      startTick()
    } catch {
      setError('Could not start recording on this device. Pick a video from gallery instead.')
    }
  }, [finalizeFromChunks, ready, recState, startTick])

  const pauseRecording = useCallback(() => {
    const rec = recorderRef.current
    if (!rec || rec.state !== 'recording') return
    try {
      rec.pause()
      clearTick()
      setRecState('paused')
    } catch {
      rec.stop()
    }
  }, [clearTick])

  const resumeRecording = useCallback(() => {
    const rec = recorderRef.current
    if (!rec || rec.state !== 'paused') return
    try {
      rec.resume()
      setRecState('recording')
      startTick()
    } catch {
      setError('Could not resume recording.')
    }
  }, [startTick])

  const finishRecording = useCallback(() => {
    const rec = recorderRef.current
    if (!rec || rec.state === 'inactive') return
    clearTick()
    try {
      if (rec.state === 'recording' || rec.state === 'paused') {
        rec.requestData?.()
        rec.stop()
      }
    } catch {
      void finalizeFromChunks()
    }
  }, [clearTick, finalizeFromChunks])
  const onShutter = useCallback(() => {
    if (finalizing) return
    if (recState === 'idle') startRecording()
    else if (recState === 'recording') pauseRecording()
    else if (recState === 'paused') resumeRecording()
  }, [finalizing, pauseRecording, recState, resumeRecording, startRecording])

  const formatClock = (s: number) => {
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${m}:${r.toString().padStart(2, '0')}`
  }

  return (
    <div className="fixed inset-0 z-50 bg-black text-white">
      <div className="relative mx-auto h-full w-full max-w-[430px]">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`absolute inset-0 h-full w-full object-cover ${facing === 'user' ? 'scale-x-[-1]' : ''}`}
        />

        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black text-sm text-white/60">
            Starting camera…
          </div>
        )}

        {error && (
          <div className="absolute inset-x-6 top-[38%] z-10 text-center">
            <p className="text-[15px] leading-snug text-white/90 drop-shadow">{error}</p>
            <button
              type="button"
              onClick={onOpenGallery}
              className="mt-5 rounded-full bg-white px-5 py-2.5 text-[14px] font-semibold text-black"
            >
              Choose from gallery
            </button>
          </div>
        )}

        {recState !== 'idle' && (
          <div className="absolute left-1/2 top-[max(56px,calc(env(safe-area-inset-top)+44px))] z-20 -translate-x-1/2 rounded-full bg-black/45 px-3 py-1 text-[13px] font-semibold tabular-nums text-white backdrop-blur-sm">
            <span
              className={`mr-1.5 inline-block h-2 w-2 rounded-full ${
                recState === 'recording' ? 'animate-pulse bg-[var(--african-orange)]' : 'bg-[var(--african-orange)]'
              }`}
            />
            {formatClock(seconds)}
            {recState === 'paused' ? ' · Paused' : ''}
          </div>
        )}

        <div
          className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5"
          style={{ paddingTop: 'max(14px, env(safe-area-inset-top))' }}
        >
          <button
            type="button"
            onClick={() => {
              hardCleanup()
              onClose()
            }}
            className="p-1 text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]"
            aria-label="Close"
          >
            <X className="h-7 w-7 stroke-[2.5]" />
          </button>
          <span className="p-1 text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]" aria-hidden>
            <Camera className="h-6 w-6" />
          </span>
        </div>

        <div
          className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between px-8"
          style={{ paddingBottom: 'max(28px, env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            onClick={onOpenGallery}
            disabled={recState !== 'idle' || finalizing}
            className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-white/55 bg-black/25 text-white backdrop-blur-[2px] disabled:opacity-40"
            aria-label="Open gallery"
          >
            <GalleryGlyph className="h-6 w-6" />
          </button>

          <button
            type="button"
            onClick={onShutter}
            disabled={(!ready && recState === 'idle') || finalizing}
            className={`relative flex h-[72px] w-[72px] items-center justify-center rounded-full disabled:opacity-40 ${
              recState !== 'idle' ? 'border-[3px] border-white' : ''
            }`}
            aria-label={
              recState === 'idle' ? 'Start recording' : recState === 'recording' ? 'Pause' : 'Resume'
            }
          >
            {recState === 'recording' ? (
              <span className="h-7 w-7 rounded-[6px] bg-[var(--african-orange)]" />
            ) : recState === 'paused' ? (
              <span className="h-0 w-0 border-y-[12px] border-l-[20px] border-y-transparent border-l-white ml-1" />
            ) : (
              <span className="h-[68px] w-[68px] rounded-full bg-white shadow-[0_2px_12px_rgba(0,0,0,0.35)]" />
            )}
          </button>

          {recState !== 'idle' ? (
            <button
              type="button"
              onClick={finishRecording}
              disabled={finalizing || seconds < 1}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--african-orange)] text-white disabled:opacity-40"
              aria-label="Finish recording"
            >
              <Check className="h-6 w-6 stroke-[3]" />
            </button>
          ) : (
            <button
              type="button"
              onClick={flipCamera}
              disabled={!ready}
              className="flex h-11 w-11 items-center justify-center text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] disabled:opacity-40"
              aria-label="Flip camera"
            >
              <SwitchCamera className="h-7 w-7" />
            </button>
          )}
        </div>

        {recState !== 'idle' && (
          <p className="absolute bottom-[110px] inset-x-0 z-20 text-center text-[12px] text-white/70">
            {recState === 'recording' ? 'Tap to pause · ✓ to finish' : 'Tap to resume · ✓ to finish'}
          </p>
        )}
      </div>
    </div>
  )
}

export { makeThumbnail }
