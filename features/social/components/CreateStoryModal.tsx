import React, { useState, useRef, useCallback } from 'react'
import { X, Camera, Video, Music, Type, Upload, Play, Pause, Volume2, VolumeX } from 'lucide-react'
import { storiesService, CreateStoryData } from '@/features/social/services/storiesService'
import { pixabayMusicService, PixabayTrack } from '@/features/video/services/pixabayMusicService'
import { useFileUpload } from '@/shared/hooks/useFileUpload'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'react-hot-toast'

interface CreateStoryModalProps {
  isOpen: boolean
  onClose: () => void
  onStoryCreated?: () => void
}

interface MediaFile {
  id: string
  file: File
  preview: string
  type: 'image' | 'video'
  duration?: number
}

const CreateStoryModal: React.FC<CreateStoryModalProps> = ({
  isOpen,
  onClose,
  onStoryCreated
}) => {
  const { user } = useAuth()
  const { uploadMultipleFiles } = useFileUpload()
  const [step, setStep] = useState<'media' | 'music' | 'caption' | 'preview'>('media')
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const [selectedMusic, setSelectedMusic] = useState<PixabayTrack | null>(null)
  const [caption, setCaption] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [musicSearchQuery, setMusicSearchQuery] = useState('')
  const [musicResults, setMusicResults] = useState<PixabayTrack[]>([])
  const [isSearchingMusic, setIsSearchingMusic] = useState(false)
  const [selectedMusicCategory, setSelectedMusicCategory] = useState('')
  const [selectedMood, setSelectedMood] = useState('')
  const [isPlayingPreview, setIsPlayingPreview] = useState(false)
  const [previewVolume, setPreviewVolume] = useState(0.5)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  // Reset state when modal opens/closes
  React.useEffect(() => {
    if (isOpen) {
      setStep('media')
      setMediaFiles([])
      setSelectedMusic(null)
      setCaption('')
      setMusicSearchQuery('')
      setMusicResults([])
      setSelectedMusicCategory('')
      setSelectedMood('')
    }
  }, [isOpen])

  // Handle file selection
  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return

    const newMediaFiles: MediaFile[] = []
    
    Array.from(files).forEach((file) => {
      // Validate file type
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        toast.error('Please select only images or videos')
        return
      }

      // Validate file size (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        toast.error('File size must be less than 50MB')
        return
      }

      const mediaType = file.type.startsWith('image/') ? 'image' : 'video'
      const preview = URL.createObjectURL(file)
      
      const mediaFile: MediaFile = {
        id: Math.random().toString(36).substr(2, 9),
        file,
        preview,
        type: mediaType
      }

      // Get video duration if it's a video
      if (mediaType === 'video') {
        const video = document.createElement('video')
        video.src = preview
        video.onloadedmetadata = () => {
          mediaFile.duration = video.duration
        }
      }

      newMediaFiles.push(mediaFile)
    })

    // Limit to 10 files maximum
    const totalFiles = mediaFiles.length + newMediaFiles.length
    if (totalFiles > 10) {
      toast.error('Maximum 10 files allowed')
      return
    }

    setMediaFiles(prev => [...prev, ...newMediaFiles])
  }, [mediaFiles.length])

  // Search for music
  const searchMusic = useCallback(async (query: string) => {
    if (!query.trim()) return

    setIsSearchingMusic(true)
    try {
      const results = await pixabayMusicService.searchMusic(query, { perPage: 20 })
      setMusicResults(results.hits.filter(track => pixabayMusicService.isTrackSuitableForStories(track)))
    } catch (error) {
      console.error('Error searching music:', error)
      toast.error('Failed to search music')
    } finally {
      setIsSearchingMusic(false)
    }
  }, [])

  // Get music by category
  const getMusicByCategory = useCallback(async (category: string) => {
    setIsSearchingMusic(true)
    try {
      const results = await pixabayMusicService.getMusicByCategory(category, 20)
      setMusicResults(results.filter(track => pixabayMusicService.isTrackSuitableForStories(track)))
    } catch (error) {
      console.error('Error getting music by category:', error)
      toast.error('Failed to load music')
    } finally {
      setIsSearchingMusic(false)
    }
  }, [])

  // Get music by mood
  const getMusicByMood = useCallback(async (mood: string) => {
    setIsSearchingMusic(true)
    try {
      const results = await pixabayMusicService.getMusicForMood(mood, 20)
      setMusicResults(results.filter(track => pixabayMusicService.isTrackSuitableForStories(track)))
    } catch (error) {
      console.error('Error getting music by mood:', error)
      toast.error('Failed to load music')
    } finally {
      setIsSearchingMusic(false)
    }
  }, [])

  // Play/pause music preview
  const toggleMusicPreview = useCallback((track: PixabayTrack) => {
    if (selectedMusic?.id === track.id && isPlayingPreview) {
      if (audioRef.current) {
        audioRef.current.pause()
      }
      setIsPlayingPreview(false)
    } else {
      if (audioRef.current) {
        audioRef.current.src = track.preview_url
        audioRef.current.volume = previewVolume
        audioRef.current.play()
        setIsPlayingPreview(true)
      }
    }
  }, [selectedMusic, isPlayingPreview, previewVolume])

  // Upload story
  const uploadStory = useCallback(async () => {
    if (!user || mediaFiles.length === 0) {
      console.warn('Cannot upload story: user=', !!user, 'mediaFiles=', mediaFiles.length)
      toast.error('Please add media files before uploading')
      return
    }

    setIsUploading(true)
    try {
      console.log('📸 Starting story upload:', {
        fileCount: mediaFiles.length,
        userId: user.id,
        hasMusic: !!selectedMusic,
        captionLength: caption.length
      })

      // Upload all media files using the proper hook
      const filesToUpload = mediaFiles.map(mf => mf.file)
      console.log('📤 Uploading', filesToUpload.length, 'files to B2 storage...')

      // Determine bucket based on media type (use post-videos for both images and videos in stories)
      const hasVideos = mediaFiles.some(mf => mf.type === 'video')
      const bucket = hasVideos ? 'post-videos' : 'post-images'

      console.log('📦 Upload bucket:', bucket, 'for file types:', mediaFiles.map(m => m.type))

      const uploadResults = await uploadMultipleFiles(filesToUpload, {
        bucket, // Use post-videos for videos (500MB limit), post-images for images (10MB limit)
        compress: mediaFiles.some(mf => mf.type === 'image') // Compress images only
      })

      console.log('📋 Upload results:', uploadResults)

      // Check for upload errors
      const failedUploads = uploadResults.filter(result => result.error)
      if (failedUploads.length > 0) {
        const errorDetails = failedUploads.map(f => f.error).join(', ')
        console.error('❌ File upload failures:', errorDetails)
        throw new Error(`Failed to upload ${failedUploads.length} file(s): ${errorDetails}`)
      }

      if (uploadResults.length === 0 || !uploadResults[0]?.url) {
        console.error('❌ Upload results empty or no URL returned:', uploadResults)
        throw new Error('No files were uploaded successfully')
      }

      // Create story data for each uploaded file
      const storyDataArray = uploadResults.map((result, index) => {
        if (!result.url) {
          throw new Error(`File ${index + 1} has no URL`)
        }
        return {
          media_url: result.url,
          media_type: mediaFiles[index].type,
          caption: caption || undefined,
          music_url: selectedMusic?.audio_url,
          music_title: selectedMusic?.title,
          music_artist: selectedMusic?.artist
        } as CreateStoryData
      })

      console.log('📝 Creating story records in database...', storyDataArray.length, 'stories')

      // Create stories
      const createPromises = storyDataArray.map((storyData, index) => {
        console.log(`Creating story ${index + 1}/${storyDataArray.length}:`, storyData.media_type)
        return storiesService.createStory(storyData)
      })

      const createdStories = await Promise.all(createPromises)
      console.log('✅ All stories created successfully!', createdStories.length, 'stories')

      toast.success(`Story${createdStories.length > 1 ? 'ies' : ''} created successfully!`)
      onStoryCreated?.()
      onClose()
    } catch (error) {
      console.error('❌ Error uploading story:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to create story'
      console.error('Full error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
      toast.error(errorMessage)
    } finally {
      setIsUploading(false)
    }
  }, [user, mediaFiles, caption, selectedMusic, onStoryCreated, onClose, uploadMultipleFiles])

  // Remove media file
  const removeMediaFile = useCallback((id: string) => {
    setMediaFiles(prev => {
      const file = prev.find(f => f.id === id)
      if (file) {
        URL.revokeObjectURL(file.preview)
      }
      return prev.filter(f => f.id !== id)
    })
  }, [])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 min-h-screen">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-primary-600 text-white p-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Create Story</h2>
       <button
  onClick={onClose}
  className="  transition-colors text-white hover:text-gray-300 cursor-pointer "
>
  <X className="w-5 h-5 " />
</button>

        </div>

        {/* Progress Steps */}
        <div className="px-4 py-3 bg-gray-50">
          <div className="flex items-center space-x-2">
            {['media', 'music', 'caption', 'preview'].map((stepName, index) => (
              <div key={stepName} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === stepName ? 'bg-primary-600 text-white' :
                  ['media', 'music', 'caption', 'preview'].indexOf(step) > index ? 'bg-green-500 text-white' :
                  'bg-gray-300 text-gray-600'
                }`}>
                  {index + 1}
                </div>
                {index < 3 && (
                  <div className={`w-8 h-0.5 ${
                    ['media', 'music', 'caption', 'preview'].indexOf(step) > index ? 'bg-green-500' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {/* Step 1: Media Selection */}
          {step === 'media' && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Add Photos & Videos</h3>
                <p className="text-gray-600 mb-4">Select up to 10 images or videos for your story</p>
              </div>

              {/* File Upload Area */}
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary-500 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">Click to select files or drag and drop</p>
                <p className="text-sm text-gray-500">Images: JPG, PNG, GIF • Videos: MP4, MOV, AVI (max 50MB each)</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={(e) => handleFileSelect(e.target.files)}
                className="hidden"
              />

              {/* Selected Media Preview */}
              {mediaFiles.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-semibold">Selected Media ({mediaFiles.length}/10)</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {mediaFiles.map((mediaFile) => (
                      <div key={mediaFile.id} className="relative group">
                        <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                          {mediaFile.type === 'image' ? (
                            <img
                              src={mediaFile.preview}
                              alt="Preview"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <video
                              src={mediaFile.preview}
                              className="w-full h-full object-cover"
                              muted
                            />
                          )}
                        </div>
                        <button
                          onClick={() => removeMediaFile(mediaFile.id)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        {mediaFile.type === 'video' && mediaFile.duration && (
                          <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                            {Math.round(mediaFile.duration)}s
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={() => setStep('music')}
                  disabled={mediaFiles.length === 0}
                  className="btn-sm-primary"
                >
                  Next: Add Music
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Music Selection */}
          {step === 'music' && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Add Background Music</h3>
                <p className="text-gray-600 mb-4">Choose a track to accompany your story (optional)</p>
              </div>

              {/* Music Search */}
              <div className="space-y-4">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="Search for music..."
                    value={musicSearchQuery}
                    onChange={(e) => setMusicSearchQuery(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    onClick={() => searchMusic(musicSearchQuery)}
                    disabled={!musicSearchQuery.trim() || isSearchingMusic}
                    className="btn-sm-secondary"
                  >
                    {isSearchingMusic ? 'Searching...' : 'Search'}
                  </button>
                </div>

                {/* Music Categories */}
                <div className="space-y-2">
                  <h4 className="font-semibold">Browse by Category</h4>
                  <div className="flex flex-wrap gap-2">
                    {pixabayMusicService.getMusicCategories().slice(0, 8).map((category) => (
                      <button
                        key={category}
                        onClick={() => {
                          setSelectedMusicCategory(category)
                          getMusicByCategory(category)
                        }}
                        className={`px-3 py-1 rounded-full text-sm transition-colors  capitalize ${
                          selectedMusicCategory === category
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mood Categories */}
                <div className="space-y-2">
                  <h4 className="font-semibold">Browse by Mood</h4>
                  <div className="flex flex-wrap gap-2">
                    {pixabayMusicService.getMoodCategories().map((mood) => (
                      <button
                        key={mood}
                        onClick={() => {
                          setSelectedMood(mood)
                          getMusicByMood(mood)
                        }}
                        className={`px-3 py-1 rounded-full text-sm transition-colors capitalize ${
                          selectedMood === mood
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {mood}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Music Results */}
              {musicResults.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold">Available Tracks</h4>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {musicResults.map((track) => (
                      <div
                        key={track.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedMusic?.id === track.id
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setSelectedMusic(track)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h5 className="font-medium">{track.title}</h5>
                            <p className="text-sm text-gray-600">{track.artist}</p>
                            <p className="text-xs text-gray-500">{track.duration}s • {track.genre}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleMusicPreview(track)
                              }}
                              className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                            >
                              {selectedMusic?.id === track.id && isPlayingPreview ? (
                                <Pause className="w-4 h-4" />
                              ) : (
                                <Play className="w-4 h-4" />
                              )}
                            </button>
                            {selectedMusic?.id === track.id && (
                              <div className="flex items-center space-x-1">
                                <Volume2 className="w-4 h-4" />
                                <input
                                  type="range"
                                  min="0"
                                  max="1"
                                  step="0.1"
                                  value={previewVolume}
                                  onChange={(e) => setPreviewVolume(parseFloat(e.target.value))}
                                  className="w-16"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected Music */}
              {selectedMusic && (
                <div className="p-3 bg-primary-50 border border-primary-200 rounded-lg">
                  <h4 className="font-semibold text-primary-800">Selected Track</h4>
                  <p className="text-primary-700">{selectedMusic.title} by {selectedMusic.artist}</p>
                </div>
              )}

              <div className="flex justify-between">
                <button
                  onClick={() => setStep('media')}
                  className="btn-sm-secondary"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep('caption')}
                  className="btn-sm-primary"
                >
                  Next: Add Caption
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Caption */}
          {step === 'caption' && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Add Caption</h3>
                <p className="text-gray-600 mb-4">Write a caption for your story (optional)</p>
              </div>

              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="What's happening?"
                className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                maxLength={200}
              />
              <div className="text-right text-sm text-gray-500">
                {caption.length}/200
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep('music')}
                  className="btn-sm-secondary"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep('preview')}
                  className="btn-sm-primary"
                >
                  Next: Preview
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Preview Your Story</h3>
                <p className="text-gray-600 mb-4">Review your story before publishing</p>
              </div>

              {/* Story Preview */}
              <div className="bg-gray-900 rounded-lg p-4 space-y-4">
                <div className="flex items-center space-x-3 text-white">
                  <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
                    <span className="text-sm font-semibold">
                      {user?.user_metadata?.full_name?.charAt(0) || 'U'}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold">{user?.user_metadata?.full_name || 'User'}</p>
                    <p className="text-xs text-gray-300">now</p>
                  </div>
                </div>

                {/* Media Preview */}
                <div className="space-y-2">
                  {mediaFiles.map((mediaFile, index) => (
                    <div key={mediaFile.id} className="relative">
                      {mediaFile.type === 'image' ? (
                        <img
                          src={mediaFile.preview}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-48 object-cover rounded-lg"
                        />
                      ) : (
                        <video
                          src={mediaFile.preview}
                          className="w-full h-48 object-cover rounded-lg"
                          muted
                        />
                      )}
                    </div>
                  ))}
                </div>

                {/* Caption */}
                {caption && (
                  <div className="text-white">
                    <p className="text-sm">{caption}</p>
                  </div>
                )}

                {/* Music Info */}
                {selectedMusic && (
                  <div className="flex items-center space-x-2 text-white">
                    <Music className="w-4 h-4" />
                    <span className="text-sm">{selectedMusic.title} - {selectedMusic.artist}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep('caption')}
                  className="btn-sm-secondary"
                >
                  Back
                </button>
                <button
                  onClick={uploadStory}
                  disabled={isUploading}
                  className="btn-sm-primary"
                >
                  {isUploading ? 'Creating Story...' : 'Create Story'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Hidden audio element for music preview */}
        <audio
          ref={audioRef}
          onEnded={() => setIsPlayingPreview(false)}
          onPause={() => setIsPlayingPreview(false)}
        />
      </div>
    </div>
  )
}

export default CreateStoryModal