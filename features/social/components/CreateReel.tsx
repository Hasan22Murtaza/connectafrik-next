import React, { useState, useRef, useCallback, useEffect } from 'react'
import { X, Upload, Play, Pause, Volume2, VolumeX, Settings, Tag, Globe, Lock, Camera, Square, RotateCcw } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useCreateReel } from '@/shared/hooks/useReels'
import { REEL_CATEGORIES, REEL_ASPECT_RATIOS, MAX_REEL_DURATION, MAX_REEL_TITLE_LENGTH, MAX_REEL_DESCRIPTION_LENGTH, MAX_REEL_TAGS } from '@/shared/types/reels'
import { ReelCategory } from '@/shared/types/reels'
import toast from 'react-hot-toast'
import { useFileUpload } from '@/shared/hooks/useFileUpload'

interface CreateReelProps {
  onSuccess?: (createdReel: any) => void
  onCancel: () => void
}

const CreateReel: React.FC<CreateReelProps> = ({ onSuccess, onCancel }) => {
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

    // Validate file type
    if (!file.type.startsWith('video/')) {
      toast.error('Please select a valid video file')
      return
    }

    // Validate file size (max 100MB)
    const maxSize = 100 * 1024 * 1024 // 100MB
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

    // Get video duration
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

      // Generate thumbnail
      video.currentTime = duration / 2
      video.onseeked = () => {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(video, 0, 0)
        const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8)
        setThumbnailUrl(thumbnailUrl)
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
        // Don't update state if play failed
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
      
      // Stop existing stream if any
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop())
      }
      
      // Try high resolution first, then fallback to basic constraints
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: aspectRatio === '9:16' ? 1080 : 1920 },
          height: { ideal: aspectRatio === '9:16' ? 1920 : 1080 },
          facingMode: facingMode
        },
        audio: true
      }

      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints)
      } catch (highResError) {
        console.log('High resolution not supported, trying basic constraints')
        // Fallback to basic constraints with proper type
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
        videoRef.current.muted = true // Mute preview to avoid feedback
        videoRef.current.play() // Ensure video plays
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
        
        // Get video duration
        const video = document.createElement('video')
        video.onloadedmetadata = () => {
          setVideoDuration(Math.round(video.duration))
        }
        video.src = url
        
        // Keep the preview showing the recorded video
        if (videoRef.current) {
          videoRef.current.src = url
          videoRef.current.srcObject = null
        }
      }

      mediaRecorder.start(1000) // Collect data every second
      setIsRecording(true)
      setIsPaused(false)
      setRecordingTime(0)
      setShowPreview(true) // Ensure preview stays visible

      // Start recording timer
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
      
      // Resume timer
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
    if (!dataUrl || !dataUrl.startsWith('data:')) {
      return null
    }

    const parts = dataUrl.split(',')
    if (parts.length < 2) {
      return null
    }

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

      toast.success('Reel created successfully!')
      onSuccess?.(data)
    } catch (err) {
      console.error('Error creating reel:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to create reel')
    } finally {
      setIsSubmitting(false)
    }
  }, [videoFile, title, description, videoDuration, thumbnailUrl, aspectRatio, category, tags, isPublic, uploadFile, dataUrlToFile, createReel, onSuccess])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between sm:px-6 px-3 py-4 bg-primary-600 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-white">Create New Reel</h2>
          <button
            onClick={onCancel}
            className="text-white hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-3 sm:p-6 space-y-6 max-h-[80vh] overflow-y-auto ">
          {/* Video Upload/Recording Section */}
          <div className="space-y-4">            
            {!videoFile && recordingMode === 'upload' ? (
              <div className="space-y-4">
                {/* Mode Selection */}
                <div className="flex space-x-4">
                  <button
                    type="button"
                    onClick={() => setRecordingMode('upload')}
                    className={`flex-1 py-3 px-4 rounded-lg border-2 transition-colors ${
                      recordingMode === 'upload'
                        ? 'border-orange-400 bg-primary-50 text-primary-700'
                        : 'border-gray-300 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    <Upload className="w-5 h-5 mx-auto mb-2" />
                    <span className="text-sm font-medium">Upload Video</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRecordingMode('record')
                      startCamera('user').catch(err => console.error('Camera error:', err))
                    }}
                    className={`flex-1 py-3 px-4 rounded-lg border-2 transition-colors ${
                      (recordingMode as string) === 'record'
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-300 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    <Camera className="w-5 h-5 mx-auto mb-2" />
                    <span className="text-sm font-medium">Record Video</span>
                  </button>
                </div>

                {/* Upload Interface */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">Click to upload or drag and drop</p>
                  <p className="text-sm text-gray-500 mb-4">
                    MP4, MOV, AVI up to 100MB • Max {MAX_REEL_DURATION / 60} minutes
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-primary"
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
                {/* Camera Preview */}
                <div className="relative bg-black rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-64 object-cover scale-110"
                    style={{ transform: 'scale(1.1)' }}
                  />
                  
                  {/* Camera Flip Button */}
                  <button
                    type="button"
                    onClick={flipCamera}
                    className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
                    title={`Switch to ${cameraFacing === 'user' ? 'back' : 'front'} camera`}
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>
                  
                  {/* Recording Controls */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                    <div className="flex items-center justify-center space-x-4">
                      {!isRecording ? (
                        <button
                          type="button"
                          onClick={startRecording}
                          className="bg-red-600 hover:bg-red-700 text-white rounded-full p-4 transition-colors"
                        >
                          <Camera className="w-6 h-6" />
                        </button>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={isPaused ? resumeRecording : pauseRecording}
                            className="bg-yellow-600 hover:bg-yellow-700 text-white rounded-full p-3 transition-colors"
                          >
                            {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                          </button>
                          <button
                            type="button"
                            onClick={stopRecording}
                            className="bg-red-600 hover:bg-red-700 text-white rounded-full p-3 transition-colors"
                          >
                            <Square className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {/* Recording Timer */}
                    {isRecording && (
                      <div className="text-center mt-2">
                        <div className="text-white text-sm font-medium">
                          {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                        </div>
                        <div className="text-white/70 text-xs">
                          {isPaused ? 'Paused' : 'Recording...'}
                        </div>
                      </div>
                    )}
                    
                    {/* Camera Indicator */}
                    <div className="absolute top-4 left-4 bg-black/50 text-white px-2 py-1 rounded text-xs">
                      {cameraFacing === 'user' ? 'Front Camera' : 'Back Camera'}
                    </div>
                  </div>
                </div>

                {/* Camera Controls */}
                <div className="flex justify-center space-x-4">
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="btn-secondary"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </button>
                  {videoFile && (
                    <button
                      type="button"
                      onClick={discardRecording}
                      className="btn-secondary"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
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
                {/* Video Preview */}
                <div className="relative bg-black rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    className="w-full h-64 object-contain"
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={() => setIsPlaying(false)}
                  />
                  
                  {/* Video Controls */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                    <div className="flex items-center space-x-4">
                      <button
                        type="button"
                        onClick={handlePlayPause}
                        className="text-white hover:text-gray-300 transition-colors"
                      >
                        {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                      </button>
                      
                      <div className="flex-1">
                        <input
                          type="range"
                          min="0"
                          max={videoDuration}
                          value={currentTime}
                          onChange={handleSeek}
                          className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                        />
                        <div className="flex justify-between text-xs text-white mt-1">
                          <span>{formatTime(currentTime)}</span>
                          <span>{formatTime(videoDuration)}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
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
                          className="w-16 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-sm text-gray-600">
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

          {/* Video Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Give your reel a catchy title..."
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
                  placeholder="Tell people what your reel is about..."
                  rows={3}
                  className="w-full px-0 py-2 text-base text-gray-900 placeholder-gray-400 border-0 border-b border-gray-300 focus:outline-none focus:ring-0 resize-none bg-transparent"
                  maxLength={MAX_REEL_DESCRIPTION_LENGTH}
                />
                <div className="text-right text-xs text-gray-500 mt-1">
                  {description.length}/{MAX_REEL_DESCRIPTION_LENGTH}
                </div>
              </div>

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
                      className={` sm:p-3 p-2 border rounded-lg text-[12px] font-medium transition-colors ${
                        aspectRatio === ratio.value
                          ? 'border-orange-500 bg-primary-50 text-primary-700'
                          : 'border-gray-300 text-gray-700 hover:border-gray-400'
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

            {/* Right Column */}
            <div className="space-y-4">
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
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                      placeholder="Add a tag..."
                      className="input-field flex-1"
                      maxLength={20}
                    />
                    <button
                      type="button"
                      onClick={addTag}
                      disabled={!newTag.trim() || tags.length >= MAX_REEL_TAGS}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
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

              {/* Video Info */}
              {videoFile && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Video Information</h4>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div>File: {videoFile.name}</div>
                    <div>Size: {(videoFile.size / (1024 * 1024)).toFixed(1)} MB</div>
                    <div>Duration: {formatTime(videoDuration)}</div>
                    <div>Type: {videoFile.type}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || isSubmitting || isUploadingFile || !videoFile || !title.trim()}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading || isSubmitting || isUploadingFile ? 'Creating...' : 'Create Reel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateReel
