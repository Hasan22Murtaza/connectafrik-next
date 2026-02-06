'use client'

import React, { useState, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Upload, Sparkles, X, ImagePlus } from 'lucide-react'
import { createStory, CreateStoryData } from '@/features/social/services/storiesService'
import { useFileUpload } from '@/shared/hooks/useFileUpload'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'react-hot-toast'
import {
  StoryTypeSelector,
  GradientPicker,
  TextEditor,
  STORY_GRADIENTS,
  type StoryType,
  type TextStyle
} from '@/features/social/components/story'

interface MediaFile {
  id: string
  file: File
  preview: string
  type: 'image' | 'video'
  duration?: number
}

const MAX_FILE_SIZE = 50 * 1024 * 1024
const MAX_CAPTION_LENGTH = 200

export default function CreateStoryPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { uploadMultipleFiles } = useFileUpload()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [storyType, setStoryType] = useState<StoryType>(null)
  const [mediaFile, setMediaFile] = useState<MediaFile | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [selectedGradient, setSelectedGradient] = useState(STORY_GRADIENTS[0].gradient)
  const [selectedBackgroundColor, setSelectedBackgroundColor] = useState(STORY_GRADIENTS[0].colors[0])
  const [textStyle, setTextStyle] = useState<TextStyle>({
    text: '',
    fontSize: 24,
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    color: '#FFFFFF',
    backgroundColor: 'transparent',
    align: 'center',
    isBold: false
  })
  const [caption, setCaption] = useState('')
  const [isUploading, setIsUploading] = useState(false)

  const userName = user?.user_metadata?.full_name || 'User'
  const userAvatar = user?.user_metadata?.avatar_url

  const canSubmit = useMemo(() => {
    if (storyType === 'photo') return !!mediaFile
    if (storyType === 'text') return !!textStyle.text.trim()
    return false
  }, [storyType, mediaFile, textStyle.text])

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

    if (!canSubmit) return

    setIsUploading(true)
    try {
      let mediaUrl = ''
      let mediaType: 'image' | 'video' = 'image'

      if (storyType === 'photo' && mediaFile) {
        const bucket = mediaFile.type === 'video' ? 'post-videos' : 'post-images'
        const uploadResults = await uploadMultipleFiles([mediaFile.file], {
          bucket,
          compress: mediaFile.type === 'image'
        })

        if (!uploadResults.length || !uploadResults[0]?.url) {
          throw new Error('Failed to upload media')
        }

        mediaUrl = uploadResults[0].url
        mediaType = mediaFile.type
      } else if (storyType === 'text') {
        mediaUrl = `gradient:${selectedGradient}`
        mediaType = 'image'
      }

      const textOverlay = storyType === 'text' ? JSON.stringify({
        text: textStyle.text,
        fontSize: textStyle.fontSize,
        fontFamily: textStyle.fontFamily,
        color: textStyle.color,
        backgroundColor: textStyle.backgroundColor,
        align: textStyle.align,
        isBold: textStyle.isBold,
        x: 50,
        y: 50
      }) : undefined

      const storyData: CreateStoryData = {
        media_url: mediaUrl,
        media_type: mediaType,
        caption: caption || textStyle.text || undefined,
        text_overlay: textOverlay,
        background_color: storyType === 'text' ? selectedBackgroundColor : '#000000'
      }

      await createStory(storyData)
      toast.success('Story created successfully!')
      router.push('/feed')
    } catch (error) {
      console.error('Error uploading story:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create story')
    } finally {
      setIsUploading(false)
    }
  }, [user, canSubmit, storyType, mediaFile, textStyle, selectedGradient, selectedBackgroundColor, caption, uploadMultipleFiles, router])

  const handleBack = useCallback(() => {
    if (storyType) {
      clearMedia()
      setStoryType(null)
    } else {
      router.back()
    }
  }, [storyType, clearMedia, router])

  const handleDiscard = useCallback(() => {
    clearMedia()
    router.push('/feed')
  }, [clearMedia, router])

  if (!storyType) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
            <div className="flex items-center h-14 sm:h-16 gap-3 sm:gap-4">
              <button onClick={handleBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-base sm:text-lg font-semibold text-gray-900">Create Story</h1>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center min-h-[calc(100vh-56px)] sm:min-h-[calc(100vh-64px)]">
          <StoryTypeSelector onSelect={setStoryType} userName={userName} userAvatar={userAvatar} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-2 sm:gap-4">
              <button onClick={handleBack} className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-base sm:text-lg font-semibold text-gray-900">
                {storyType === 'photo' ? 'Photo Story' : 'Text Story'}
              </h1>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <button onClick={handleDiscard} className="hidden sm:block px-4 py-2 text-gray-500 hover:text-gray-700 font-medium text-sm">
                Discard
              </button>
              <button
                onClick={uploadStory}
                disabled={isUploading || !canSubmit}
                className="px-3 sm:px-5 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-medium text-xs sm:text-sm rounded-lg transition-all flex items-center gap-1.5 sm:gap-2"
              >
                {isUploading ? (
                  <>
                    <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span className="hidden sm:inline">Sharing...</span>
                    <span className="sm:hidden">...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Share Story</span>
                    <span className="sm:hidden">Share</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row h-[calc(100vh-56px)] sm:h-[calc(100vh-64px)]">
        <div className="order-2 lg:order-1 flex-1 lg:flex-none lg:w-[340px] bg-white lg:border-r border-t lg:border-t-0 border-gray-200 flex flex-col max-h-[40vh] lg:max-h-none">
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 sm:space-y-6">
            {storyType === 'photo' ? (
              <>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2 sm:mb-3">Media</h3>
                  {!mediaFile ? (
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`relative rounded-xl sm:rounded-2xl border-2 border-dashed p-4 sm:p-6 text-center cursor-pointer transition-all ${
                        isDragging ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary-100 flex items-center justify-center mx-auto mb-2 sm:mb-3">
                        <ImagePlus className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600" />
                      </div>
                      <p className="text-xs sm:text-sm font-medium text-gray-900 mb-0.5 sm:mb-1">Add photo or video</p>
                      <p className="text-[10px] sm:text-xs text-gray-500">Tap to browse</p>
                    </div>
                  ) : (
                    <div className="relative rounded-xl sm:rounded-2xl overflow-hidden bg-gray-100 aspect-video lg:aspect-[9/16]">
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
                  <label className="block text-sm font-semibold text-gray-900 mb-1.5 sm:mb-2">Caption</label>
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Write something..."
                    maxLength={MAX_CAPTION_LENGTH}
                    className="w-full h-16 sm:h-20 bg-gray-50 border border-gray-200 rounded-lg sm:rounded-xl px-3 py-2 sm:py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  />
                  <p className="text-[10px] sm:text-xs text-gray-400 mt-1 text-right">{caption.length}/{MAX_CAPTION_LENGTH}</p>
                </div>
              </>
            ) : (
              <>
                <GradientPicker
                  selectedGradient={selectedGradient}
                  onSelect={(gradient) => {
                    setSelectedGradient(gradient.gradient)
                    setSelectedBackgroundColor(gradient.colors[0])
                  }}
                />
                <TextEditor style={textStyle} onChange={(changes) => setTextStyle(prev => ({ ...prev, ...changes }))} />
              </>
            )}
          </div>
        </div>

        <div className="order-1 lg:order-2 flex-1 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center p-4 sm:p-8 min-h-[60vh] lg:min-h-0">
          <div className="relative">
            <div className="w-[200px] h-[356px] sm:w-[280px] sm:h-[498px] lg:w-[300px] lg:h-[534px] bg-gray-900 rounded-[2rem] sm:rounded-[2.5rem] lg:rounded-[3rem] p-[4px] sm:p-[5px] lg:p-[6px] shadow-2xl">
              <div className="relative w-full h-full bg-black rounded-[1.75rem] sm:rounded-[2.25rem] lg:rounded-[2.5rem] overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 sm:w-24 sm:h-6 lg:w-28 lg:h-7 bg-black rounded-b-2xl sm:rounded-b-3xl z-30" />

                <div className="absolute top-2 sm:top-3 left-3 sm:left-4 right-3 sm:right-4 z-20 flex gap-1">
                  <div className="flex-1 h-[2px] sm:h-[3px] bg-white/40 rounded-full overflow-hidden">
                    <div className="h-full w-1/2 bg-white rounded-full" />
                  </div>
                </div>

                <div className="absolute top-7 sm:top-9 lg:top-10 left-3 sm:left-4 right-3 sm:right-4 z-20 flex items-center gap-2 sm:gap-2.5">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center ring-2 ring-white/30 overflow-hidden">
                    {userAvatar ? (
                      <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white text-xs sm:text-sm font-semibold">{userName.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div>
                    <p className="text-white text-xs sm:text-sm font-semibold drop-shadow">{userName}</p>
                    <p className="text-white/70 text-[10px] sm:text-xs drop-shadow">Just now</p>
                  </div>
                </div>

                {storyType === 'photo' ? (
                  mediaFile ? (
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
                        <Upload className="w-8 h-8 sm:w-10 sm:h-10 text-gray-600 mx-auto mb-1.5 sm:mb-2" />
                        <p className="text-gray-500 text-xs sm:text-sm">Add media</p>
                      </div>
                    </div>
                  )
                ) : (
                  <div className={`absolute inset-0 bg-gradient-to-br ${selectedGradient} flex items-center justify-center p-4 sm:p-6`}>
                    {textStyle.text ? (
                      <p
                        className="max-w-full break-words px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg"
                        style={{
                          fontSize: `${textStyle.fontSize * 0.6}px`,
                          fontFamily: textStyle.fontFamily,
                          color: textStyle.color,
                          backgroundColor: textStyle.backgroundColor,
                          textAlign: textStyle.align,
                          fontWeight: textStyle.isBold ? 'bold' : 'normal'
                        }}
                      >
                        {textStyle.text}
                      </p>
                    ) : (
                      <p className="text-white/50 text-sm sm:text-lg">Start typing...</p>
                    )}
                  </div>
                )}

                {caption && storyType === 'photo' && (
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
    </div>
  )
}
