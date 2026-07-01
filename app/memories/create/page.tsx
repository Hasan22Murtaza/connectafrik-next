'use client'

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useCreateReel } from '@/shared/hooks/useReels'
import {
  MAX_REEL_DURATION,
  MAX_REEL_DESCRIPTION_LENGTH,
  MAX_REEL_TITLE_LENGTH,
  MAX_REEL_TAGS,
} from '@/shared/types/reels'
import { ReelCategory } from '@/shared/types/reels'
import toast from 'react-hot-toast'
import { useFileUpload } from '@/shared/hooks/useFileUpload'
import { MediaSection } from './components/MediaSection'
import { DetailsForm } from './components/DetailsForm'
import { ReviewStep } from './components/ReviewStep'
import { WizardHeaderActions, type CreateStep } from './components/WizardNavigation'

type SubmitStage = 'idle' | 'uploading-video' | 'uploading-thumbnail' | 'publishing'

const STEP_SUBTITLES: Record<CreateStep, string> = {
  media: 'Upload or record your video',
  details: 'Add a title and choose who can see it',
  review: 'Review everything before you publish',
}

const ASPECT_RATIO_STYLES: Record<
  string,
  { containerClass: string; width: string; height: string; cameraWidth: number; cameraHeight: number }
> = {
  '9:16': { containerClass: 'max-w-[280px] w-full', width: '100%', height: 'auto', cameraWidth: 1080, cameraHeight: 1920 },
  '16:9': { containerClass: 'max-w-full w-full', width: '100%', height: 'auto', cameraWidth: 1920, cameraHeight: 1080 },
  '1:1': { containerClass: 'max-w-[360px] w-full', width: '100%', height: 'auto', cameraWidth: 1080, cameraHeight: 1080 },
  '4:3': { containerClass: 'max-w-[420px] w-full', width: '100%', height: 'auto', cameraWidth: 1440, cameraHeight: 1080 },
}

const ASPECT_RATIO_CSS: Record<string, string> = {
  '9:16': '9/16',
  '16:9': '16/9',
  '1:1': '1/1',
  '4:3': '4/3',
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

const CreateMemoryPage: React.FC = () => {
  const router = useRouter()
  const { createReel, loading } = useCreateReel()
  const { uploadFile, uploading: isUploadingFile } = useFileUpload()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<ReelCategory>('entertainment')
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9' | '1:1' | '4:3'>('9:16')

  const previewStyle = useMemo(() => ASPECT_RATIO_STYLES[aspectRatio] || ASPECT_RATIO_STYLES['9:16'], [aspectRatio])

  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState<string>('')
  const [videoDuration, setVideoDuration] = useState<number>(0)
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState(1)

  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null)
  const [recordingMode, setRecordingMode] = useState<'upload' | 'record'>('upload')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [isDragging, setIsDragging] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [submitStage, setSubmitStage] = useState<SubmitStage>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState<CreateStep>('media')

  const videoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const isReadyToPublish = Boolean(videoFile && title.trim())
  const isPublishing = submitStage !== 'idle'

  const canGoNext =
    currentStep === 'media'
      ? Boolean(videoFile) && !isRecording
      : currentStep === 'details'
        ? Boolean(title.trim())
        : isReadyToPublish

  const publishLabel =
    submitStage === 'uploading-video'
      ? 'Uploading…'
      : submitStage === 'uploading-thumbnail'
        ? 'Thumbnail…'
        : submitStage === 'publishing'
          ? 'Publishing…'
          : 'Publish'

  const revokeVideoUrl = useCallback((url: string) => {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url)
    }
  }, [])

  const clearVideo = useCallback(() => {
    if (videoUrl) revokeVideoUrl(videoUrl)
    setVideoFile(null)
    setVideoUrl('')
    setVideoDuration(0)
    setThumbnailUrl('')
    setIsPlaying(false)
    setCurrentTime(0)
    setValidationError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop())
      setMediaStream(null)
    }
    if (videoRef.current) videoRef.current.srcObject = null
    setRecordingMode('upload')
  }, [videoUrl, revokeVideoUrl, mediaStream])

  const processVideoFile = useCallback(
    (file: File) => {
      setValidationError(null)

      if (!file.type.startsWith('video/')) {
        const message = 'Please select a valid video file'
        setValidationError(message)
        toast.error(message)
        return
      }

      const maxSize = 100 * 1024 * 1024
      if (file.size > maxSize) {
        const message = 'Video file size must be less than 100MB'
        setValidationError(message)
        toast.error(message)
        return
      }

      setVideoFile(file)
      if (videoUrl) revokeVideoUrl(videoUrl)
      const url = URL.createObjectURL(file)
      setVideoUrl(url)

      const video = document.createElement('video')
      video.onloadedmetadata = () => {
        const duration = Math.round(video.duration)
        setVideoDuration(duration)

        if (duration > MAX_REEL_DURATION) {
          const message = `Video must be shorter than ${MAX_REEL_DURATION / 60} minutes`
          setValidationError(message)
          toast.error(message)
          setVideoFile(null)
          revokeVideoUrl(url)
          setVideoUrl('')
          setVideoDuration(0)
          return
        }

        video.currentTime = duration / 2
        video.onseeked = () => {
          const canvas = document.createElement('canvas')
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          const ctx = canvas.getContext('2d')
          ctx?.drawImage(video, 0, 0)
          setThumbnailUrl(canvas.toDataURL('image/jpeg', 0.8))
        }
      }
      video.src = url
    },
    [videoUrl, revokeVideoUrl]
  )

  const handleVideoSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (file) processVideoFile(file)
    },
    [processVideoFile]
  )

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      const file = e.dataTransfer.files?.[0]
      if (file) processVideoFile(file)
    },
    [processVideoFile]
  )

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleInsertHashtag = useCallback((tag: string) => {
    const snippet = description.trim() ? ` #${tag}` : `#${tag}`
    setDescription((prev) => {
      const next = prev + snippet
      return next.length <= MAX_REEL_DESCRIPTION_LENGTH ? next : prev
    })
  }, [description])

  const handleInsertEmoji = useCallback((emoji: string) => {
    setDescription((prev) => {
      const next = prev + emoji
      return next.length <= MAX_REEL_DESCRIPTION_LENGTH ? next : prev
    })
  }, [])

  const handlePlayPause = useCallback(async () => {
    if (videoRef.current) {
      try {
        if (isPlaying) {
          videoRef.current.pause()
          setIsPlaying(false)
        } else {
          await videoRef.current.play()
          setIsPlaying(true)
        }
      } catch (error) {
        console.error('Video play/pause error:', error)
      }
    }
  }, [isPlaying])

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime)
  }, [])

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    if (videoRef.current) videoRef.current.volume = newVolume
    setIsMuted(newVolume === 0)
  }, [])

  const handleMuteToggle = useCallback(() => {
    if (videoRef.current) {
      if (isMuted) {
        videoRef.current.volume = volume
        setIsMuted(false)
      } else {
        videoRef.current.volume = 0
        setIsMuted(true)
      }
    }
  }, [isMuted, volume])

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value)
    if (videoRef.current) {
      videoRef.current.currentTime = newTime
      setCurrentTime(newTime)
    }
  }, [])

  const addTag = useCallback(() => {
    if (newTag.trim() && tags.length < MAX_REEL_TAGS) {
      const tag = newTag.trim().toLowerCase()
      if (!tags.includes(tag)) {
        setTags([...tags, tag])
        setNewTag('')
      }
    }
  }, [newTag, tags])

  const removeTag = useCallback((tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove))
  }, [tags])

  const startCamera = useCallback(
    async (facingMode: 'user' | 'environment' = cameraFacing) => {
      try {
        setCameraError(null)

        if (mediaStream) {
          mediaStream.getTracks().forEach((track) => track.stop())
        }

        const ratioConfig = ASPECT_RATIO_STYLES[aspectRatio] || ASPECT_RATIO_STYLES['9:16']
        const constraints: MediaStreamConstraints = {
          video: {
            width: { ideal: ratioConfig.cameraWidth },
            height: { ideal: ratioConfig.cameraHeight },
            facingMode: facingMode,
          },
          audio: true,
        }

        let stream
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints)
        } catch {
          const basicConstraints: MediaStreamConstraints = {
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: facingMode as 'user' | 'environment',
            },
            audio: true,
          }
          stream = await navigator.mediaDevices.getUserMedia(basicConstraints)
        }

        setMediaStream(stream)
        setCameraFacing(facingMode)

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.muted = true
          videoRef.current.play()
        }

        setRecordingMode('record')
      } catch (error: unknown) {
        console.error('Camera access error:', error)
        const err = error as { name?: string }
        let errorMessage = 'Camera access denied. Please allow camera permissions and try again.'

        if (err.name === 'NotAllowedError') {
          errorMessage = 'Camera permission denied. Please allow camera access in your browser settings.'
        } else if (err.name === 'NotFoundError') {
          errorMessage = 'No camera found. Please connect a camera and try again.'
        } else if (err.name === 'NotReadableError') {
          errorMessage = 'Camera is being used by another application. Please close other apps and try again.'
        }

        setCameraError(errorMessage)
        toast.error(errorMessage)
      }
    },
    [aspectRatio, cameraFacing, mediaStream]
  )

  const flipCamera = useCallback(async () => {
    const newFacing = cameraFacing === 'user' ? 'environment' : 'user'
    await startCamera(newFacing)
  }, [cameraFacing, startCamera])

  const stopCamera = useCallback(() => {
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop())
      setMediaStream(null)
    }
    if (videoRef.current) videoRef.current.srcObject = null
    setRecordingMode('upload')
    setCameraError(null)
  }, [mediaStream])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setIsPaused(false)

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
        recordingIntervalRef.current = null
      }
    }
  }, [isRecording])

  const startRecording = useCallback(() => {
    if (!mediaStream) return

    try {
      const mediaRecorder = new MediaRecorder(mediaStream, {
        mimeType: 'video/webm;codecs=vp9,opus',
      })

      mediaRecorderRef.current = mediaRecorder
      recordedChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' })
        const url = URL.createObjectURL(blob)
        setVideoUrl(url)
        setVideoFile(new File([blob], 'recording.webm', { type: 'video/webm' }))

        const video = document.createElement('video')
        video.onloadedmetadata = () => setVideoDuration(Math.round(video.duration))
        video.src = url

        if (videoRef.current) {
          videoRef.current.src = url
          videoRef.current.srcObject = null
        }
      }

      mediaRecorder.start(1000)
      setIsRecording(true)
      setIsPaused(false)
      setRecordingTime(0)

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1
          if (newTime >= MAX_REEL_DURATION) stopRecording()
          return newTime
        })
      }, 1000)
    } catch (error) {
      console.error('Recording start error:', error)
      toast.error('Failed to start recording')
    }
  }, [mediaStream, stopRecording])

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause()
      setIsPaused(true)

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
        recordingIntervalRef.current = null
      }
    }
  }, [isRecording, isPaused])

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume()
      setIsPaused(false)

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1
          if (newTime >= MAX_REEL_DURATION) stopRecording()
          return newTime
        })
      }, 1000)
    }
  }, [isRecording, isPaused, stopRecording])

  const discardRecording = useCallback(() => {
    stopRecording()
    stopCamera()
    clearVideo()
    setRecordingTime(0)
    recordedChunksRef.current = []
  }, [stopRecording, stopCamera, clearVideo])

  const handleWizardBack = useCallback(() => {
    if (isPublishing) return
    if (currentStep === 'media') {
      router.back()
      return
    }
    if (currentStep === 'details') setCurrentStep('media')
    else if (currentStep === 'review') setCurrentStep('details')
  }, [currentStep, isPublishing, router])

  const handleWizardNext = useCallback(() => {
    if (isPublishing) return

    if (currentStep === 'media') {
      if (!videoFile) {
        toast.error('Please add a video before continuing')
        return
      }
      if (isRecording) {
        toast.error('Stop recording before continuing')
        return
      }
      if (recordingMode === 'record' && mediaStream) stopCamera()
      setCurrentStep('details')
      return
    }

    if (currentStep === 'details') {
      if (!title.trim()) {
        toast.error('Please enter a title before continuing')
        return
      }
      if (title.length > MAX_REEL_TITLE_LENGTH) {
        toast.error(`Title must be ${MAX_REEL_TITLE_LENGTH} characters or less`)
        return
      }
      if (description.length > MAX_REEL_DESCRIPTION_LENGTH) {
        toast.error(`Description must be ${MAX_REEL_DESCRIPTION_LENGTH} characters or less`)
        return
      }
      setShowEmojiPicker(false)
      setCurrentStep('review')
    }
  }, [
    currentStep,
    isPublishing,
    videoFile,
    isRecording,
    recordingMode,
    mediaStream,
    stopCamera,
    title,
    description,
  ])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [currentStep])

  useEffect(() => {
    return () => {
      if (mediaStream) mediaStream.getTracks().forEach((track) => track.stop())
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current)
      if (videoUrl) revokeVideoUrl(videoUrl)
    }
  }, [mediaStream, videoUrl, revokeVideoUrl])

  const dataUrlToFile = useCallback((dataUrl: string, filename: string): File | null => {
    if (!dataUrl || !dataUrl.startsWith('data:')) return null

    const parts = dataUrl.split(',')
    if (parts.length < 2) return null

    const mimeMatch = parts[0].match(/:(.*?);/)
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg'

    try {
      const binaryString = atob(parts[1])
      const len = binaryString.length
      const bytes = new Uint8Array(len)
      for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i)
      return new File([bytes], filename, { type: mime })
    } catch (error) {
      console.error('Failed to convert data URL to file:', error)
      return null
    }
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (currentStep !== 'review') return
      if (!videoFile) {
        toast.error('Please select a video file')
        return
      }

      if (!title.trim()) {
        toast.error('Please enter a title')
        return
      }

      if (title.length > MAX_REEL_TITLE_LENGTH) {
        toast.error(`Title must be ${MAX_REEL_TITLE_LENGTH} characters or less`)
        return
      }

      if (description.length > MAX_REEL_DESCRIPTION_LENGTH) {
        toast.error(`Description must be ${MAX_REEL_DESCRIPTION_LENGTH} characters or less`)
        return
      }

      let progressTimer: ReturnType<typeof setInterval> | null = null

      try {
        setIsSubmitting(true)
        setSubmitStage('uploading-video')
        setUploadProgress(8)

        progressTimer = setInterval(() => {
          setUploadProgress((prev) => (prev < 55 ? prev + 4 : prev))
        }, 400)

        const uploadResult = await uploadFile(videoFile, { bucket: 'post-videos' })
        if (uploadResult.error || !uploadResult.url) {
          throw new Error(uploadResult.error || 'Video upload failed')
        }

        if (progressTimer) clearInterval(progressTimer)
        setUploadProgress(62)

        let uploadedThumbnailUrl: string | undefined
        if (thumbnailUrl) {
          setSubmitStage('uploading-thumbnail')
          setUploadProgress(68)

          if (thumbnailUrl.startsWith('http')) {
            uploadedThumbnailUrl = thumbnailUrl
          } else {
            const fileName = `thumbnail_${Date.now()}.jpg`
            const thumbnailFile = dataUrlToFile(thumbnailUrl, fileName)
            if (thumbnailFile) {
              const thumbnailUpload = await uploadFile(thumbnailFile, { bucket: 'post-images' })
              if (thumbnailUpload.error) {
                console.warn('Thumbnail upload failed:', thumbnailUpload.error)
              } else {
                uploadedThumbnailUrl = thumbnailUpload.url || undefined
              }
            }
          }
        }

        setSubmitStage('publishing')
        setUploadProgress(85)

        const reelData = {
          title: title.trim(),
          description: description.trim() || undefined,
          video_url: uploadResult.url,
          thumbnail_url: uploadedThumbnailUrl,
          duration: videoDuration,
          aspect_ratio: aspectRatio,
          category,
          tags,
          is_public: isPublic,
        }

        const { error } = await createReel(reelData)

        if (error) {
          toast.error(error)
          return
        }

        setUploadProgress(100)
        toast.success('Memory created successfully!')
        router.push('/memories/foryou')
      } catch (err) {
        console.error('Error creating reel:', err)
        toast.error(err instanceof Error ? err.message : 'Failed to create memory')
      } finally {
        if (progressTimer) clearInterval(progressTimer)
        setIsSubmitting(false)
        setSubmitStage('idle')
        setUploadProgress(0)
      }
    },
    [
      currentStep,
      videoFile,
      title,
      description,
      videoDuration,
      thumbnailUrl,
      aspectRatio,
      category,
      tags,
      isPublic,
      uploadFile,
      dataUrlToFile,
      createReel,
      router,
    ]
  )

  return (
    <div className="flex min-h-screen flex-col bg-surface-canvas">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-6">
          <button
            type="button"
            onClick={handleWizardBack}
            disabled={isPublishing}
            className="rounded-full p-2 text-content transition-colors hover:bg-surface-hover disabled:opacity-50"
            aria-label={currentStep === 'media' ? 'Exit' : 'Go back one step'}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold text-content sm:text-lg">Create Memory</h1>
            <p className="truncate text-[11px] text-content-secondary sm:text-xs">
              {STEP_SUBTITLES[currentStep]}
            </p>
          </div>
          <WizardHeaderActions
            currentStep={currentStep}
            canGoNext={canGoNext && !loading && !isSubmitting && !isUploadingFile}
            isPublishing={isPublishing}
            publishLabel={publishLabel}
            onNext={handleWizardNext}
          />
        </div>
        {isPublishing && (
          <div className="h-0.5 w-full bg-border" aria-hidden>
            <div
              className="h-full bg-[var(--african-orange)] transition-all duration-300 ease-out"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 px-3 py-4 sm:px-6 sm:py-6">
        <form id="create-memory-form" onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          {currentStep === 'media' && (
            <MediaSection
              recordingMode={recordingMode}
              setRecordingMode={setRecordingMode}
              videoFile={videoFile}
              videoUrl={videoUrl}
              videoDuration={videoDuration}
              thumbnailUrl={thumbnailUrl}
              aspectRatio={aspectRatio}
              aspectRatioCss={ASPECT_RATIO_CSS}
              previewStyle={previewStyle}
              isDragging={isDragging}
              isPlaying={isPlaying}
              isMuted={isMuted}
              currentTime={currentTime}
              volume={volume}
              isRecording={isRecording}
              isPaused={isPaused}
              recordingTime={recordingTime}
              cameraError={cameraError}
              cameraFacing={cameraFacing}
              validationError={validationError}
              videoRef={videoRef}
              fileInputRef={fileInputRef}
              formatTime={formatTime}
              formatFileSize={formatFileSize}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onBrowseClick={handleBrowseClick}
              onVideoInputChange={handleVideoSelect}
              onStartCamera={startCamera}
              onFlipCamera={flipCamera}
              onStopCamera={stopCamera}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
              onPauseRecording={pauseRecording}
              onResumeRecording={resumeRecording}
              onDiscardRecording={discardRecording}
              onClearVideo={clearVideo}
              onPlayPause={handlePlayPause}
              onTimeUpdate={handleTimeUpdate}
              onSeek={handleSeek}
              onMuteToggle={handleMuteToggle}
              onVolumeChange={handleVolumeChange}
              onVideoEnded={() => setIsPlaying(false)}
            />
          )}

          {currentStep === 'details' && (
            <DetailsForm
              title={title}
              setTitle={setTitle}
              description={description}
              setDescription={setDescription}
              category={category}
              setCategory={setCategory}
              aspectRatio={aspectRatio}
              setAspectRatio={setAspectRatio}
              tags={tags}
              newTag={newTag}
              setNewTag={setNewTag}
              addTag={addTag}
              removeTag={removeTag}
              isPublic={isPublic}
              setIsPublic={setIsPublic}
              showAdvanced={showAdvanced}
              setShowAdvanced={setShowAdvanced}
              showEmojiPicker={showEmojiPicker}
              setShowEmojiPicker={setShowEmojiPicker}
              videoFile={videoFile}
              videoDuration={videoDuration}
              formatTime={formatTime}
              formatFileSize={formatFileSize}
              onInsertHashtag={handleInsertHashtag}
              onInsertEmoji={handleInsertEmoji}
            />
          )}

          {currentStep === 'review' && videoFile && (
            <ReviewStep
              title={title}
              description={description}
              thumbnailUrl={thumbnailUrl}
              videoFile={videoFile}
              videoDuration={videoDuration}
              aspectRatio={aspectRatio}
              category={category}
              tags={tags}
              isPublic={isPublic}
              formatTime={formatTime}
              formatFileSize={formatFileSize}
            />
          )}
        </form>
      </div>
    </div>
  )
}

export default CreateMemoryPage
