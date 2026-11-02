import { MAX_REEL_DURATION } from '@/shared/types/reels'

export type CapturedReelMedia = {
  file: File
  preview: string
  duration: number
  thumbnailUrl: string
}

export function formatTrimTime(seconds: number): string {
  const safe = Math.max(0, seconds)
  const m = Math.floor(safe / 60)
  const s = safe - m * 60
  return `${m}:${s.toFixed(1).padStart(4, '0')}`
}

export function revokePreviewUrl(url: string) {
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
}

export async function makeThumbnail(
  _file: File,
  previewUrl: string
): Promise<{ duration: number; thumbnailUrl: string }> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    let settled = false
    const finish = (duration: number, thumbnailUrl: string) => {
      if (settled) return
      settled = true
      resolve({ duration, thumbnailUrl })
    }

    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0
      const seekTo = Math.min(Math.max(duration / 2, 0.05), Math.max(duration - 0.05, 0.05))
      const onSeeked = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = video.videoWidth || 720
          canvas.height = video.videoHeight || 1280
          canvas.getContext('2d')?.drawImage(video, 0, 0)
          finish(Math.round(duration) || 0, canvas.toDataURL('image/jpeg', 0.8))
        } catch {
          finish(Math.round(duration) || 0, '')
        }
      }
      video.addEventListener('seeked', onSeeked, { once: true })
      try {
        video.currentTime = seekTo
      } catch {
        finish(Math.round(duration) || 0, '')
      }
    }
    video.onerror = () => finish(0, '')
    video.src = previewUrl
  })
}

export async function extractFilmstrip(
  previewUrl: string,
  count = 10
): Promise<string[]> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    const frames: string[] = []

    video.onloadedmetadata = async () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0
      if (duration <= 0) {
        resolve([])
        return
      }
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve([])
        return
      }

      for (let i = 0; i < count; i++) {
        const t = (duration * i) / Math.max(count - 1, 1)
        await new Promise<void>((res) => {
          const onSeeked = () => {
            canvas.width = 72
            canvas.height = 128
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            frames.push(canvas.toDataURL('image/jpeg', 0.6))
            res()
          }
          video.addEventListener('seeked', onSeeked, { once: true })
          video.currentTime = Math.min(t, Math.max(duration - 0.05, 0))
        })
      }
      resolve(frames)
    }
    video.onerror = () => resolve([])
    video.src = previewUrl
  })
}
export async function trimVideoFile(
  source: CapturedReelMedia,
  startSec: number,
  endSec: number,
  onProgress?: (ratio: number) => void
): Promise<CapturedReelMedia> {
  const duration = Math.max(0.1, endSec - startSec)
  if (startSec <= 0.05 && endSec >= source.duration - 0.05) {
    return source
  }

  const video = document.createElement('video')
  video.src = source.preview
  video.playsInline = true
  video.muted = false
  video.preload = 'auto'

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve()
    video.onerror = () => reject(new Error('Could not load video for trim'))
  })

  const capture =
    typeof (video as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream ===
    'function'
      ? (video as HTMLVideoElement & { captureStream: () => MediaStream }).captureStream()
      : typeof (video as HTMLVideoElement & { mozCaptureStream?: () => MediaStream }).mozCaptureStream ===
          'function'
        ? (video as HTMLVideoElement & { mozCaptureStream: () => MediaStream }).mozCaptureStream()
        : null

  if (!capture) {
    return {
      ...source,
      duration: Math.min(Math.round(duration), MAX_REEL_DURATION),
    }
  }

  let mime = 'video/webm;codecs=vp9,opus'
  if (typeof MediaRecorder !== 'undefined' && !MediaRecorder.isTypeSupported(mime)) {
    mime = MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : ''
  }
  if (!mime) {
    return { ...source, duration: Math.min(Math.round(duration), MAX_REEL_DURATION) }
  }

  const chunks: Blob[] = []
  const recorder = new MediaRecorder(capture, { mimeType: mime })
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  const recorded = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime }))
    recorder.onerror = () => reject(new Error('Trim recording failed'))
  })

  video.currentTime = startSec
  await new Promise<void>((resolve) => {
    const done = () => resolve()
    video.addEventListener('seeked', done, { once: true })
  })

  recorder.start(200)
  await video.play()

  await new Promise<void>((resolve) => {
    const onTime = () => {
      const progress = (video.currentTime - startSec) / duration
      onProgress?.(Math.min(1, Math.max(0, progress)))
      if (video.currentTime >= endSec - 0.04) {
        video.pause()
        video.removeEventListener('timeupdate', onTime)
        resolve()
      }
    }
    video.addEventListener('timeupdate', onTime)
    window.setTimeout(() => {
      video.pause()
      video.removeEventListener('timeupdate', onTime)
      resolve()
    }, Math.ceil(duration * 1000) + 1500)
  })

  if (recorder.state !== 'inactive') recorder.stop()
  capture.getTracks().forEach((t) => t.stop())

  const blob = await recorded
  const file = new File([blob], `reel-trim-${Date.now()}.webm`, { type: mime })
  const preview = URL.createObjectURL(blob)
  const meta = await makeThumbnail(file, preview)

  return {
    file,
    preview,
    duration: meta.duration || Math.round(duration),
    thumbnailUrl: meta.thumbnailUrl,
  }
}
