'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Upload, Sparkles, X, ImagePlus } from '@/shared/icons'
import { createStory, CreateStoryData } from '@/features/social/services/storiesService'
import { useFileUpload } from '@/shared/hooks/useFileUpload'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'react-hot-toast'
import { formatStoryRelativeTime } from '@/features/social/components/story/storyRelativeTime'
import TextStoryEditor from '@/features/social/components/story/TextStoryEditor'
import { DimensionValueSource } from '@aws-sdk/client-ses'

interface MediaFile {
  id: string
  file: File
  preview: string
  type: 'image' | 'video'
  duration?: number
}

const MAX_FILE_SIZE = 50 * 1024 * 1024
const MAX_CAPTION_LENGTH = 250

const toSafeDisplayName = (value: unknown): string => {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || 'User'
  }
  return 'User'
}

const getInitial = (name: string): string => {
  if (!name) return 'U'
  return name.charAt(0).toUpperCase()
}

export default function CreateStoryPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { uploadMultipleFiles } = useFileUpload()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [activeTab, setActiveTab] = useState<'media' | 'text'>('media')
  const [mediaFile, setMediaFile] = useState<MediaFile | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [caption, setCaption] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isTextPosting, setIsTextPosting] = useState(false)
  const [previewStartedAt] = useState(() => new Date().toISOString())
  const [, setPreviewTimeTick] = useState(0)

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'text') {
      setActiveTab('text')
    }
  }, [])

  const userName = toSafeDisplayName(user?.user_metadata?.full_name)
  const userAvatar = user?.user_metadata?.avatar_url

  useEffect(() => {
    const id = window.setInterval(() => setPreviewTimeTick((n) => n + 1), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const previewTimeLabel = formatStoryRelativeTime(previewStartedAt)

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files?.length) return

    const file = files[0]
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      toast.error('Please select an image or video')
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error('File size must be less than 50MB')
      return
    }

    const mediaType = file.type.startsWith('image/') ? 'image' : 'video'
    const preview = URL.createObjectURL(file)

    setMediaFile({
      id: Math.random().toString(36).substr(2, 9),
      file,
      preview,
      type: mediaType
    })
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileSelect(e.dataTransfer.files)
  }, [handleFileSelect])

  const clearMedia = useCallback(() => {
    if (mediaFile) {
      URL.revokeObjectURL(mediaFile.preview)
      setMediaFile(null)
    }
  }, [mediaFile])

  const uploadStory = useCallback(async () => {
    if (!user) {
      toast.error('Please sign in to create a story')
      return
    }

    if (!mediaFile) return

    setIsUploading(true)
    try {
      const bucket = mediaFile.type === 'video' ? 'post-videos' : 'post-images'
      const uploadResults = await uploadMultipleFiles([mediaFile.file], {
        bucket,
        compress: mediaFile.type === 'image'
      })

      if (!uploadResults.length || !uploadResults[0]?.url) {
        throw new Error('Failed to upload media')
      }

      const storyData: CreateStoryData = {
        media_url: uploadResults[0].url,
        media_type: mediaFile.type,
        ...(caption.trim() ? { caption: caption.trim() } : {}),
      }

      const createdStory = await createStory(storyData)
      toast.success('Story created successfully!')

      // Dispatch event so StoriesBar can instantly show the new story (no page refresh needed)
      window.dispatchEvent(new CustomEvent('story-created', { detail: createdStory }))

      router.push('/feed')
    } catch (error) {
      console.error('Error uploading story:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create story')
    } finally {
      setIsUploading(false)
    }
  }, [user, mediaFile, caption, uploadMultipleFiles, router])

  const handleBack = useCallback(() => {
    clearMedia()
    router.push('/feed')
  }, [clearMedia, router])

  const handleDiscard = useCallback(() => {
    clearMedia()
    router.push('/feed')
  }, [clearMedia, router])

  return (
    <div className="min-h-screen overflow-y-auto bg-surface  lg:inset-0 lg:grid lg:h-dvh lg:grid-cols-[340px_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)] lg:overflow-hidden">
      <aside >
        <div className="px-3 pt-3 sm:px-5 sm:pt-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <button onClick={handleBack} aria-label="Back to feed" className="rounded-full p-1.5 text-content-secondary transition-colors hover:bg-surface-hover">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                <h1 className="text-sm font-semibold leading-tight text-content">Create Story</h1>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button onClick={handleDiscard} className="px-2 py-1.5 text-[10px] font-medium text-content-secondary transition hover:text-content sm:px-3">
                Discard
              </button>
              {activeTab === 'media' ? (
                <button
                  onClick={uploadStory}
                  disabled={isUploading || !mediaFile}
                  className="btn-primary flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Sharing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3" />
                      Share
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="submit"
                  form="text-story-form"
                  disabled={isTextPosting}
                  className="btn-primary flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles className="h-3 w-3" />
                  {isTextPosting ? 'Sharing...' : 'Share'}
                </button>
              )}
            </div>
          </div>
        </div>
        <div role="tablist" aria-label="Story type" className="mx-3 mb-2 mt-4 flex rounded-lg bg-surface-secondary p-1 sm:mx-5">
          <button
            type="button"
            id="media-story-tab"
            role="tab"
            aria-selected={activeTab === 'media'}
            aria-controls="media-story-panel"
            onClick={() => setActiveTab('media')}
            className={`flex-1 rounded-md px-3 py-1.5 text-[10px] font-semibold transition-colors ${activeTab === 'media' ? 'bg-white text-primary-600 shadow-sm' : 'text-content-secondary hover:text-content'
              }`}
          >
            Media story
          </button>
          <button
            type="button"
            id="text-story-tab"
            role="tab"
            aria-selected={activeTab === 'text'}
            aria-controls="text-story-panel"
            onClick={() => setActiveTab('text')}
            className={`flex-1 rounded-md px-3 py-1.5 text-[10px] font-semibold transition-colors ${activeTab === 'text' ? 'bg-white text-primary-600 shadow-sm' : 'text-content-secondary hover:text-content'
              }`}
          >
            Text story
          </button>
        </div>
      </aside>

      {activeTab === 'media' ? (
        <div
          role="tabpanel"
          id="media-story-panel"
          aria-labelledby="media-story-tab"
          className="flex flex-col lg:contents"
        >
          <div className="order-2 flex max-h-[45vh] flex-1 flex-col border-t border-border bg-surface lg:col-start-1 lg:row-start-2 lg:order-none lg:min-h-0 lg:max-h-none lg:w-full">
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 sm:space-y-6">
              <div>
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-content sm:mb-3">Media</h3>
                {!mediaFile ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative flex min-h-[130px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-4 text-center transition-all sm:rounded-2xl ${isDragging ? 'border-primary-500 bg-primary-50' : 'border-border hover:border-primary-300 hover:bg-surface-hover'
                      }`}
                  >
                    <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50">
                      <ImagePlus className="h-4 w-4 text-primary-600" />
                    </div>
                    <p className="mb-0.5 text-xs font-medium text-content">Add photo or video</p>
                    <p className="text-[9px] text-content-secondary">Tap to browse or drop file here</p>
                    <div className="mt-2 flex items-center gap-1.5 text-[8px] text-content-tertiary">
                      <span className="rounded bg-surface-secondary px-1.5 py-0.5">JPG</span>
                      <span className="rounded bg-surface-secondary px-1.5 py-0.5">PNG</span>
                      <span className="rounded bg-surface-secondary px-1.5 py-0.5">MP4</span>
                      <span>Up to 50MB</span>
                    </div>
                  </div>
                ) : (
                  <div className="relative rounded-xl sm:rounded-2xl overflow-hidden bg-surface-secondary aspect-video lg:aspect-[9/16]">
                    {mediaFile.type === 'image' ? (
                      <img src={mediaFile.preview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <video src={mediaFile.preview} className="w-full h-full object-cover" muted loop autoPlay playsInline />
                    )}
                    <button
                      onClick={clearMedia}
                      className="absolute top-2 sm:top-3 right-2 sm:right-3 w-7 h-7 sm:w-8 sm:h-8 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-colors"
                    >
                      <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-2 sm:bottom-3 inset-x-2 sm:inset-x-3 py-1.5 sm:py-2 bg-black/50 hover:bg-black/70 rounded-lg text-white text-[10px] sm:text-xs font-medium transition-colors"
                    >
                      Change
                    </button>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={(e) => handleFileSelect(e.target.files)} className="hidden" />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor="media-story-caption" className="text-[10px] font-semibold uppercase tracking-wide text-content">Caption</label>
                  <span className="text-[9px] text-content-secondary">{caption.length}/{MAX_CAPTION_LENGTH}</span>
                </div>
                <textarea
                  id="media-story-caption"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="What would you like to share?"
                  maxLength={MAX_CAPTION_LENGTH}
                  className="h-28 w-full resize-none rounded-xl border border-border px-3 py-2.5 text-xs text-content placeholder:text-content-tertiary focus:border-transparent focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
          </div>

          <div className="order-1 flex min-h-[55vh] flex-1 items-center justify-center bg-transparent p-4 sm:p-8 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:order-none lg:min-h-0 ">
            <div className="relative">
              <div className="w-[200px] h-[356px] sm:w-[280px] sm:h-[498px] lg:w-[300px] lg:h-[534px] bg-gray-900 rounded-[2rem] sm:rounded-[2.5rem] lg:rounded-[3rem] p-[4px] sm:p-[5px] lg:p-[6px] shadow-2xl">
                <div className="relative w-full h-full bg-black rounded-[1.75rem] sm:rounded-[2.25rem] lg:rounded-[2.5rem] overflow-hidden">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 sm:w-24 sm:h-6 lg:w-28 lg:h-7 bg-black rounded-b-2xl sm:rounded-b-3xl z-30" />

                  <div className="absolute top-2 sm:top-3 left-3 sm:left-4 right-3 sm:right-4 z-20 flex gap-1">
                    <div className="flex-1 h-[2px] sm:h-[3px] bg-surface/40 rounded-full overflow-hidden">
                      <div className="h-full w-1/2 bg-surface rounded-full" />
                    </div>
                  </div>

                  <div className="absolute top-7 sm:top-9 lg:top-10 left-3 sm:left-4 right-3 sm:right-4 z-20 flex items-center gap-2 sm:gap-2.5">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center ring-2 ring-white/30 overflow-hidden">
                      {userAvatar ? (
                        <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white text-xs sm:text-sm font-semibold">{getInitial(userName)}</span>
                      )}
                    </div>
                    <div>
                      <p className="text-white text-xs sm:text-sm font-semibold drop-shadow">{userName}</p>
                      <p className="text-white/70 text-[10px] sm:text-xs drop-shadow">{previewTimeLabel}</p>
                    </div>
                  </div>

                  {mediaFile ? (
                    <div className="absolute inset-0">
                      {mediaFile.type === 'image' ? (
                        <img src={mediaFile.preview} alt="Story" className="w-full h-full object-cover" />
                      ) : (
                        <video src={mediaFile.preview} className="w-full h-full object-cover" autoPlay muted loop playsInline />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/50" />
                    </div>
                  ) : (
                    <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                      <div className="text-center">
                        <Upload className="w-8 h-8 sm:w-10 sm:h-10 text-content-secondary mx-auto mb-1.5 sm:mb-2" />
                        <p className="text-content-secondary text-xs sm:text-sm">Add media</p>
                      </div>
                    </div>
                  )}

                  {caption && (
                    <div className="absolute bottom-4 sm:bottom-6 left-3 sm:left-4 right-3 sm:right-4 z-20">
                      <p className="text-white text-xs sm:text-sm bg-black/40 backdrop-blur-sm rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 line-clamp-2">
                        {caption}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="hidden lg:block absolute -inset-8 bg-gradient-to-br from-primary-400/20 to-purple-400/20 rounded-[4rem] blur-2xl -z-10" />
            </div>
          </div>
        </div>
      ) : (
        <div role="tabpanel" id="text-story-panel" aria-labelledby="text-story-tab" className="lg:contents">
          <TextStoryEditor onPostingChange={setIsTextPosting} />
        </div>
      )}
    </div>
  )
}
