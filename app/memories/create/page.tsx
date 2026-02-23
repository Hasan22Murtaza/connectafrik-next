'use client'

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { X, Upload, Play, Pause, Volume2, VolumeX, Tag, Globe, Lock, Camera, Square, RotateCcw, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useCreateReel } from '@/shared/hooks/useReels'
import { REEL_CATEGORIES, REEL_ASPECT_RATIOS, MAX_REEL_DURATION, MAX_REEL_TITLE_LENGTH, MAX_REEL_DESCRIPTION_LENGTH, MAX_REEL_TAGS } from '@/shared/types/reels'
import { ReelCategory } from '@/shared/types/reels'
import toast from 'react-hot-toast'
import { useFileUpload } from '@/shared/hooks/useFileUpload'

// Aspect ratio to CSS dimensions mapping for preview
const ASPECT_RATIO_STYLES: Record<string, { containerClass: string; width: string; height: string; cameraWidth: number; cameraHeight: number }> = {
  '9:16': { containerClass: 'max-w-[280px] w-full', width: '100%', height: 'auto', cameraWidth: 1080, cameraHeight: 1920 },
  '16:9': { containerClass: 'max-w-full w-full', width: '100%', height: 'auto', cameraWidth: 1920, cameraHeight: 1080 },
  '1:1': { containerClass: 'max-w-[360px] w-full', width: '100%', height: 'auto', cameraWidth: 1080, cameraHeight: 1080 },
  '4:3': { containerClass: 'max-w-[420px] w-full', width: '100%', height: 'auto', cameraWidth: 1440, cameraHeight: 1080 },
}

// CSS aspect-ratio values for responsive sizing
const ASPECT_RATIO_CSS: Record<string, string> = {
  '9:16': '9/16',
  '16:9': '16/9',
  '1:1': '1/1',
  '4:3': '4/3',
}

const CreateMemoryPage: React.FC = () => {
  const router = useRouter()
  const { user } = useAuth()
  const { createReel, loading } = useCreateReel()
  const { uploadFile, uploading: isUploadingFile } = useFileUpload()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<ReelCategory>('entertainment')
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9' | '1:1' | '4:3'>('9:16')

  // Aspect ratio style for preview
  const previewStyle = useMemo(() => ASPECT_RATIO_STYLES[aspectRatio] || ASPECT_RATIO_STYLES['9:16'], [aspectRatio])

  // Video state
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState<string>('')
  const [videoDuration, setVideoDuration] = useState<number>(0)
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState(1)

  // Recording state
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null)
  const [recordingMode, setRecordingMode] = useState<'upload' | 'record'>('upload')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user')
  const [showPreview, setShowPreview] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const revokeVideoUrl = useCallback((url: string) => {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url)
    }
  }, [])

  const handleVideoSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('video/')) {
      toast.error('Please select a valid video file')
      return
    }

    const maxSize = 100 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error('Video file size must be less than 100MB')
      return
    }

    setVideoFile(file)
    if (videoUrl) {
      revokeVideoUrl(videoUrl)
    }
    const url = URL.createObjectURL(file)
    setVideoUrl(url)

    const video = document.createElement('video')
    video.onloadedmetadata = () => {
      const duration = Math.round(video.duration)
      setVideoDuration(duration)

      if (duration > MAX_REEL_DURATION) {
        toast.error(`Video must be shorter than ${MAX_REEL_DURATION / 60} minutes`)
        setVideoFile(null)
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
        const thumb = canvas.toDataURL('image/jpeg', 0.8)
        setThumbnailUrl(thumb)
      }
    }
    video.src = url
  }, [videoUrl, revokeVideoUrl])

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
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }, [])

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    if (videoRef.current) {
      videoRef.current.volume = newVolume
    }
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
    setTags(tags.filter(tag => tag !== tagToRemove))
  }, [tags])

  // Camera recording functions
  const startCamera = useCallback(async (facingMode: 'user' | 'environment' = cameraFacing) => {
    try {
      setCameraError(null)

      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop())
      }

      const ratioConfig = ASPECT_RATIO_STYLES[aspectRatio] || ASPECT_RATIO_STYLES['9:16']
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: ratioConfig.cameraWidth },
          height: { ideal: ratioConfig.cameraHeight },
          facingMode: facingMode
        },
        audio: true
      }

      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints)
      } catch (highResError) {
        const basicConstraints: MediaStreamConstraints = {
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: facingMode as 'user' | 'environment'
          },
          audio: true
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
      setShowPreview(true)
    } catch (error: any) {
      console.error('Camera access error:', error)
      let errorMessage = 'Camera access denied. Please allow camera permissions and try again.'

      if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera permission denied. Please allow camera access in your browser settings.'
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera found. Please connect a camera and try again.'
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Camera is being used by another application. Please close other apps and try again.'
      }

      setCameraError(errorMessage)
      toast.error(errorMessage)
    }
  }, [aspectRatio, cameraFacing, mediaStream])

  const flipCamera = useCallback(async () => {
    const newFacing = cameraFacing === 'user' ? 'environment' : 'user'
    await startCamera(newFacing)
  }, [cameraFacing, startCamera])

  const stopCamera = useCallback(() => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop())
      setMediaStream(null)
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setRecordingMode('upload')
    setCameraError(null)
  }, [mediaStream])

  const startRecording = useCallback(() => {
    if (!mediaStream) return

    try {
      const mediaRecorder = new MediaRecorder(mediaStream, {
        mimeType: 'video/webm;codecs=vp9,opus'
      })

      mediaRecorderRef.current = mediaRecorder
      recordedChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' })
        const url = URL.createObjectURL(blob)
        setVideoUrl(url)
        setVideoFile(new File([blob], 'recording.webm', { type: 'video/webm' }))

        const video = document.createElement('video')
        video.onloadedmetadata = () => {
          setVideoDuration(Math.round(video.duration))
        }
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
      setShowPreview(true)

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1
          if (newTime >= MAX_REEL_DURATION) {
            stopRecording()
          }
          return newTime
        })
      }, 1000)
    } catch (error: any) {
      console.error('Recording start error:', error)
      toast.error('Failed to start recording')
    }
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
        setRecordingTime(prev => {
          const newTime = prev + 1
          if (newTime >= MAX_REEL_DURATION) {
            stopRecording()
          }
          return newTime
        })
      }, 1000)
    }
  }, [isRecording, isPaused])

  const discardRecording = useCallback(() => {
    stopRecording()
    stopCamera()
    setVideoUrl('')
    setVideoFile(null)
    setRecordingTime(0)
    recordedChunksRef.current = []
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop())
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
      if (videoUrl) {
        revokeVideoUrl(videoUrl)
      }
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
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      return new File([bytes], filename, { type: mime })
    } catch (error) {
      console.error('Failed to convert data URL to file:', error)
      return null
    }
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()

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

    try {
      setIsSubmitting(true)

      const uploadResult = await uploadFile(videoFile, { bucket: 'post-videos' })
      if (uploadResult.error || !uploadResult.url) {
        throw new Error(uploadResult.error || 'Video upload failed')
      }

      let uploadedThumbnailUrl: string | undefined
      if (thumbnailUrl) {
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

      const reelData = {
        title: title.trim(),
        description: description.trim() || undefined,
        video_url: uploadResult.url,
        thumbnail_url: uploadedThumbnailUrl,
        duration: videoDuration,
        aspect_ratio: aspectRatio,
        category,
        tags,
        is_public: isPublic
      }

      const { data, error } = await createReel(reelData)

      if (error) {
        toast.error(error)
        return
      }

      toast.success('Memory created successfully!')
      router.push('/memories')
    } catch (err) {
      console.error('Error creating reel:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to create memory')
    } finally {
      setIsSubmitting(false)
    }
  }, [videoFile, title, description, videoDuration, thumbnailUrl, aspectRatio, category, tags, isPublic, uploadFile, dataUrlToFile, createReel, router])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-3 sm:px-6 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Create Memory</h1>
        </div>
      </div>

      {/* Page Content */}
      <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">

            {/* Video Upload/Recording Section */}
            <div className="p-3 sm:p-6">
              <h2 className="text-sm sm:text-base font-semibold text-gray-900 mb-3 sm:mb-4">Video</h2>

              {!videoFile && recordingMode === 'upload' ? (
                <div className="space-y-4">
                  {/* Mode Selection */}
                  <div className="flex gap-4 sm:gap-6">
                    <button
                      type="button"
                      onClick={() => setRecordingMode('upload')}
                      className={`flex-1 py-2.5 sm:py-3 px-3 sm:px-4 rounded-lg border-2 transition-colors ${
                        recordingMode === 'upload'
                          ? 'border-orange-400 bg-primary-50 text-primary-700'
                          : 'border-gray-300 text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      <Upload className="w-5 h-5 mx-auto mb-1 sm:mb-2" />
                      <span className="text-xs sm:text-sm font-medium">Upload Video</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRecordingMode('record')
                        startCamera('user').catch(err => console.error('Camera error:', err))
                      }}
                      className={`flex-1 py-2.5 sm:py-3 px-3 sm:px-4 rounded-lg border-2 transition-colors ${
                        (recordingMode as string) === 'record'
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-300 text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      <Camera className="w-5 h-5 mx-auto mb-1 sm:mb-2" />
                      <span className="text-xs sm:text-sm font-medium">Record Video</span>
                    </button>
                  </div>

                  {/* Upload Interface */}
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 sm:p-8 text-center">
                    <Upload className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
                    <p className="text-sm sm:text-base text-gray-600 mb-1.5 sm:mb-2">Click to upload or drag and drop</p>
                    <p className="text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4">
                      MP4, MOV, AVI up to 100MB &bull; Max {MAX_REEL_DURATION / 60} minutes
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="btn-primary text-sm sm:text-base"
                    >
                      Select Video
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/*"
                      onChange={handleVideoSelect}
                      className="hidden"
                    />
                  </div>
                </div>
              ) : recordingMode === 'record' && !videoFile ? (
                <div className="space-y-4">
                  {/* Camera Preview — aspect-ratio-aware */}
                  <div className="flex justify-center px-2 sm:px-0">
                    <div
                      className={`relative bg-black rounded-xl overflow-hidden transition-all duration-300 ${previewStyle.containerClass}`}
                      style={{ aspectRatio: ASPECT_RATIO_CSS[aspectRatio] || '9/16', maxHeight: '70vh' }}
                    >
                      <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                      />

                      {/* Aspect Ratio Badge */}
                      <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5">
                        <span>{REEL_ASPECT_RATIOS.find(r => r.value === aspectRatio)?.icon}</span>
                        <span>{aspectRatio}</span>
                      </div>

                      {/* Camera Flip Button */}
                      <button
                        type="button"
                        onClick={flipCamera}
                        className="absolute top-3 right-3 bg-black/50 hover:bg-black/70 text-white rounded-full p-2.5 transition-colors backdrop-blur-sm"
                        title={`Switch to ${cameraFacing === 'user' ? 'back' : 'front'} camera`}
                      >
                        <RotateCcw className="w-5 h-5" />
                      </button>

                      {/* Camera Indicator */}
                      <div className="absolute top-12 right-3 bg-black/50 backdrop-blur-sm text-white px-2 py-1 rounded-full text-[10px]">
                        {cameraFacing === 'user' ? 'Front' : 'Back'}
                      </div>

                      {/* Recording indicator dot */}
                      {isRecording && !isPaused && (
                        <div className="absolute top-3 left-1/2 -translate-x-1/2">
                          <div className="flex items-center gap-1.5 bg-red-600/90 backdrop-blur-sm px-3 py-1 rounded-full">
                            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                            <span className="text-white text-xs font-medium">REC</span>
                          </div>
                        </div>
                      )}

                      {/* Recording Controls */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2.5 sm:p-4 pt-8 sm:pt-10">
                        {isRecording && (
                          <div className="text-center mb-2 sm:mb-3">
                            <div className="inline-flex items-center gap-2 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full">
                              <div className={`w-2 h-2 rounded-full ${isPaused ? 'bg-yellow-400' : 'bg-red-500 animate-pulse'}`} />
                              <span className="text-white text-xs sm:text-sm font-mono font-medium">
                                {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                              </span>
                            </div>
                            <div className="text-white/60 text-[10px] mt-1">
                              {isPaused ? 'Paused' : 'Recording...'}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-center space-x-3 sm:space-x-4">
                          {!isRecording ? (
                            <button
                              type="button"
                              onClick={startRecording}
                              className="bg-red-600 hover:bg-red-700 text-white rounded-full p-3 sm:p-4 transition-all shadow-lg shadow-red-600/30 hover:scale-105 active:scale-95"
                            >
                              <Camera className="w-5 h-5 sm:w-6 sm:h-6" />
                            </button>
                          ) : (
                            <div className="flex items-center space-x-2 sm:space-x-3">
                              <button
                                type="button"
                                onClick={isPaused ? resumeRecording : pauseRecording}
                                className="bg-yellow-500 hover:bg-yellow-600 text-white rounded-full p-2.5 sm:p-3 transition-all hover:scale-105 active:scale-95"
                              >
                                {isPaused ? <Play className="w-4 h-4 sm:w-5 sm:h-5" /> : <Pause className="w-4 h-4 sm:w-5 sm:h-5" />}
                              </button>
                              <button
                                type="button"
                                onClick={stopRecording}
                                className="bg-white hover:bg-gray-100 text-red-600 rounded-full p-2.5 sm:p-3 transition-all hover:scale-105 active:scale-95 ring-2 ring-red-400"
                              >
                                <Square className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Camera Controls */}
                  <div className="flex justify-center space-x-2 sm:space-x-4">
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="btn-secondary text-xs sm:text-sm py-2 px-3 sm:px-4"
                    >
                      <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                      Cancel
                    </button>
                    {videoFile && (
                      <button
                        type="button"
                        onClick={discardRecording}
                        className="btn-secondary text-xs sm:text-sm py-2 px-3 sm:px-4"
                      >
                        <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                        Record Again
                      </button>
                    )}
                  </div>

                  {/* Camera Error */}
                  {cameraError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-red-700 text-sm">{cameraError}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Video Preview — aspect-ratio-aware */}
                  <div className="flex justify-center px-2 sm:px-0">
                    <div
                      className={`relative bg-black rounded-xl overflow-hidden transition-all duration-300 ${previewStyle.containerClass}`}
                      style={{ aspectRatio: ASPECT_RATIO_CSS[aspectRatio] || '9/16', maxHeight: '70vh' }}
                    >
                      <video
                        ref={videoRef}
                        src={videoUrl}
                        className="w-full h-full object-contain"
                        onTimeUpdate={handleTimeUpdate}
                        onEnded={() => setIsPlaying(false)}
                      />

                      {/* Aspect Ratio Badge */}
                      <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5">
                        <span>{REEL_ASPECT_RATIOS.find(r => r.value === aspectRatio)?.icon}</span>
                        <span>{aspectRatio}</span>
                      </div>

                      {/* Video Controls */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2.5 sm:p-4 pt-8 sm:pt-10">
                        <div className="flex items-center space-x-2 sm:space-x-3">
                          <button
                            type="button"
                            onClick={handlePlayPause}
                            className="text-white hover:text-gray-300 transition-colors flex-shrink-0"
                          >
                            {isPlaying ? <Pause className="w-4 h-4 sm:w-5 sm:h-5" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5" />}
                          </button>

                          <div className="flex-1 min-w-0">
                            <input
                              type="range"
                              min="0"
                              max={videoDuration}
                              value={currentTime}
                              onChange={handleSeek}
                              className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                            />
                            <div className="flex justify-between text-[10px] text-white/80 mt-0.5">
                              <span>{formatTime(currentTime)}</span>
                              <span>{formatTime(videoDuration)}</span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-1.5 flex-shrink-0">
                            <button
                              type="button"
                              onClick={handleMuteToggle}
                              className="text-white hover:text-gray-300 transition-colors"
                            >
                              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                            </button>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.1"
                              value={volume}
                              onChange={handleVolumeChange}
                              className="w-12 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider hidden sm:block"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs sm:text-sm text-gray-600 px-1">
                    <span>Duration: {formatTime(videoDuration)}</span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-primary-600 hover:text-primary-700 font-medium"
                    >
                      Change Video
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200" />

            {/* Details Section */}
            <div className="p-3 sm:p-6 space-y-3 sm:space-y-4">
              <h2 className="text-sm sm:text-base font-semibold text-gray-900">Details</h2>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Give your memory a catchy title..."
                  className="input-field"
                  maxLength={MAX_REEL_TITLE_LENGTH}
                  required
                />
                <div className="text-right text-xs text-gray-500 mt-1">
                  {title.length}/{MAX_REEL_TITLE_LENGTH}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell people what your memory is about..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm sm:text-base text-gray-900 placeholder-gray-400 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  maxLength={MAX_REEL_DESCRIPTION_LENGTH}
                />
                <div className="text-right text-xs text-gray-500 mt-1">
                  {description.length}/{MAX_REEL_DESCRIPTION_LENGTH}
                </div>
              </div>

              {/* Category & Aspect Ratio - side by side on md+ */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ReelCategory)}
                    className="input-field"
                  >
                    {REEL_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.icon} {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Aspect Ratio */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Aspect Ratio
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {REEL_ASPECT_RATIOS.map((ratio) => (
                      <button
                        key={ratio.value}
                        type="button"
                        onClick={() => setAspectRatio(ratio.value as '9:16' | '16:9' | '1:1' | '4:3')}
                        className={`sm:p-3 p-2 border rounded-lg text-[12px] font-medium transition-all duration-200 ${
                          aspectRatio === ratio.value
                            ? 'border-orange-500 bg-orange-50 text-orange-700 ring-1 ring-orange-300 shadow-sm'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center space-x-1">
                          <span>{ratio.icon}</span>
                          <span>{ratio.label}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200" />

            {/* Settings Section */}
            <div className="p-3 sm:p-6 space-y-3 sm:space-y-4">
              <h2 className="text-sm sm:text-base font-semibold text-gray-900">Settings</h2>

              {/* Tags & Privacy - side by side on md+ */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tags
                  </label>
                  <div className="space-y-2">
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            addTag()
                          }
                        }}
                        placeholder="Add a tag..."
                        className="input-field flex-1"
                        maxLength={20}
                      />
                      <button
                        type="button"
                        onClick={addTag}
                        disabled={!newTag.trim() || tags.length >= MAX_REEL_TAGS}
                        className="px-3 sm:px-4 py-2 bg-primary-600 text-white rounded-lg text-sm sm:text-base font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                      >
                        Add
                      </button>
                    </div>

                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center space-x-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                          >
                            <Tag className="w-3 h-3" />
                            <span>{tag}</span>
                            <button
                              type="button"
                              onClick={() => removeTag(tag)}
                              className="text-gray-500 hover:text-gray-700"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="text-xs text-gray-500">
                      {tags.length}/{MAX_REEL_TAGS} tags
                    </div>
                  </div>
                </div>

                {/* Privacy Settings */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Privacy
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="radio"
                        checked={isPublic}
                        onChange={() => setIsPublic(true)}
                        className="text-primary-600 focus:ring-primary-500"
                      />
                      <div className="flex items-center space-x-2">
                        <Globe className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-700">Public</span>
                      </div>
                    </label>

                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="radio"
                        checked={!isPublic}
                        onChange={() => setIsPublic(false)}
                        className="text-primary-600 focus:ring-primary-500"
                      />
                      <div className="flex items-center space-x-2">
                        <Lock className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-700">Private</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Video Info */}
              {videoFile && (
                <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Video Information</h4>
                  <div className="space-y-1.5 text-xs sm:text-sm text-gray-600">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 flex-shrink-0">File:</span>
                      <span className="font-medium text-gray-700 truncate ml-2 max-w-[50%] sm:max-w-[180px]">{videoFile.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Size:</span>
                      <span className="font-medium text-gray-700">{(videoFile.size / (1024 * 1024)).toFixed(1)} MB</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Duration:</span>
                      <span className="font-medium text-gray-700">{formatTime(videoDuration)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Type:</span>
                      <span className="font-medium text-gray-700">{videoFile.type}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Ratio:</span>
                      <span className="font-medium text-gray-700">{REEL_ASPECT_RATIOS.find(r => r.value === aspectRatio)?.label || aspectRatio}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200" />

            {/* Action Buttons */}
            <div className="p-3 sm:p-6">
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-4">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="btn-secondary text-sm sm:text-base py-2.5 sm:py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || isSubmitting || isUploadingFile || !videoFile || !title.trim()}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base py-2.5 sm:py-2"
                >
                  {loading || isSubmitting || isUploadingFile ? 'Creating...' : 'Create Memory'}
                </button>
              </div>
            </div>

          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateMemoryPage
