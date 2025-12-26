import React, { useState } from 'react'
import { Image, MapPin, Send, X, Upload, Film, Music } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/shared/hooks/useProfile'
import { useFileUpload } from '@/shared/hooks/useFileUpload'
import VideoUploader from '@/shared/components/ui/VideoUploader'
import toast from 'react-hot-toast'

interface CreatePostProps {
  onSubmit: (postData: {
    title: string
    content: string
    category: 'politics' | 'culture' | 'general'
    media_urls?: string[]
  }) => void
  onCancel?: () => void
}

const CreatePost: React.FC<CreatePostProps> = ({ onSubmit, onCancel }) => {
  const { user } = useAuth()
  const { profile } = useProfile()
  const { uploadMultipleFiles, uploading } = useFileUpload()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<'politics' | 'culture' | 'general'>('general')
  const [mediaFiles, setMediaFiles] = useState<File[]>([])
  const [videoUrl, setVideoUrl] = useState<string>('')
  const [videoKey, setVideoKey] = useState<string>('')
  const [showVideoUploader, setShowVideoUploader] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string>('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return

    // Validate title length (minimum 5 characters)
    if (title.trim().length < 5) {
      toast.error('Title must be at least 5 characters long')
      return
    }

    // Validate content length (minimum 10 characters)
    if (content.trim().length < 10) {
      toast.error('Content must be at least 10 characters long')
      return
    }

    setIsSubmitting(true)
    let media_urls: string[] = []

    try {
      // Add video URL if uploaded
      if (videoUrl) {
        media_urls.push(videoUrl)
      }

      // Upload media files if any
      if (mediaFiles.length > 0) {
        console.log('Starting file upload for', mediaFiles.length, 'files')
        setUploadProgress('Uploading media files...')

        const uploadResults = await uploadMultipleFiles(mediaFiles, {
          bucket: getMediaBucket(mediaFiles[0]),
          compress: true
        })

        console.log('Upload results:', uploadResults)

        // Check for upload errors
        const failedUploads = uploadResults.filter(result => result.error)
        if (failedUploads.length > 0) {
          throw new Error(`Failed to upload ${failedUploads.length} file(s)`)
        }

        // Get successful URLs
        const uploaded_urls = uploadResults
          .filter(result => result.url)
          .map(result => result.url!)

        media_urls = [...media_urls, ...uploaded_urls]

        const fallbackUsed = uploadResults.some(result => result.url?.startsWith('data:'))
        setUploadProgress(fallbackUsed
          ? 'Storage is offline. Media attached using temporary fallback storage.'
          : 'Media uploaded successfully!')
      }

      setUploadProgress('Creating post...')

      await onSubmit({
        title: title.trim(),
        content: content.trim(),
        category,
        media_urls: media_urls.length > 0 ? media_urls : undefined
      })

      // Reset form
      setTitle('')
      setContent('')
      setCategory('general')
      setMediaFiles([])
      setVideoUrl('')
      setVideoKey('')
      setShowVideoUploader(false)
      setUploadProgress('')
      
    } catch (error: any) {
      console.error('Error creating post:', error)
      toast.error(error.message || 'Failed to create post')
    } finally {
      setIsSubmitting(false)
      setUploadProgress('')
    }
  }

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    console.log('Files selected:', files)
    console.log('File types:', files.map(f => f.type))
    console.log('File sizes:', files.map(f => f.size))

    // 🔒 SECURITY: Client-side file size validation (10MB for images, 500MB for videos)
    const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB
    const MAX_VIDEO_SIZE = 500 * 1024 * 1024 // 500MB
    
    const oversizedFiles = files.filter(file => {
      const maxSize = file.type.startsWith('video/') ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE
      return file.size > maxSize
    })

    if (oversizedFiles.length > 0) {
      const filesText = oversizedFiles.length === 1 ? 'file' : 'files'
      const sizeMB = Math.round(oversizedFiles[0].size / 1024 / 1024)
      const maxSizeMB = oversizedFiles[0].type.startsWith('video/') ? 500 : 10
      toast.error(`${oversizedFiles.length} ${filesText} exceed the ${maxSizeMB}MB limit (largest: ${sizeMB}MB)`)
      return
    }

    setMediaFiles(prev => [...prev, ...files].slice(0, 4)) // Limit to 4 files
  }

  const removeMedia = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index))
  }

  const getMediaBucket = (file: File): 'post-images' | 'post-videos' | 'post-audio' => {
    if (file.type.startsWith('image/')) return 'post-images'
    if (file.type.startsWith('video/')) return 'post-videos'
    if (file.type.startsWith('audio/')) return 'post-audio'
    return 'post-images' // default
  }

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <Image className="w-4 h-4" />
    if (file.type.startsWith('video/')) return <Film className="w-4 h-4" />
    if (file.type.startsWith('audio/')) return <Music className="w-4 h-4" />
    return <Upload className="w-4 h-4" />
  }

const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (!user) {
    return (
      <div className="card text-center">
        <p className="text-gray-600">Please sign in to create a post.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-6">
      {/* Header */}
      <div className="flex items-center space-x-3 mb-4">
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.full_name}
            className="w-10 h-10 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center shrink-0">
            <span className="text-gray-600 font-medium">
              {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
        )}
        <div>
          <h3 className="font-semibold text-gray-900">{profile?.full_name || 'User'}</h3>
          <span className="text-gray-500 text-sm">Share your thoughts with the community</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Category Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
          <div className="flex gap-2">
            {[
              { value: 'general', label: 'General', icon: '💬' },
              { value: 'politics', label: 'Politics', icon: '🏛️' },
              { value: 'culture', label: 'Culture', icon: '🎭' }
            ].map(({ value, label, icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setCategory(value as any)}
                className={`flex items-center text-sm space-x-1 sm:px-4 px-2 sm:py-1 py-2 rounded-lg border transition-colors duration-200 ${
                  category === value
                    ? 'border-orange-400 bg-primary-200 text-orange-900'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>{icon}</span>
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Title Input */}
        <div>
          <input
            type="text"
            placeholder="What would you like to discuss?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-0 py-2 text-lg font-medium text-gray-900 placeholder-gray-400 border-0 border-b border-transparent hover:border-gray-200 focus:border-primary-500 focus:outline-none focus:ring-0 transition-colors bg-transparent"
            maxLength={200}
            required
          />
          <div className="text-right text-sm text-gray-500 mt-1">
            {title.length}/200
          </div>
        </div>

        {/* Content Textarea */}
        <div>
          <textarea
            placeholder="Share your thoughts, experiences, or insights about African politics, culture, or community..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full px-0 py-2 text-base text-gray-900 placeholder-gray-400 border-0 focus:outline-none focus:ring-0 min-h-[120px] resize-none bg-transparent"
            maxLength={2000}
            required
          />
          <div className="text-right text-sm text-gray-500 mt-1">
            {content.length}/2000
          </div>
        </div>

        {/* Upload Progress */}
        {uploadProgress && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <Upload className="w-4 h-4 text-blue-600 animate-pulse" />
              <span className="text-sm text-blue-700">{uploadProgress}</span>
            </div>
          </div>
        )}

        {/* Media Preview */}
        {mediaFiles.length > 0 && (
          <div className="space-y-3">
            <div className="text-sm font-medium text-gray-700">
              Media Files ({mediaFiles.length}/4)
            </div>
            <div className="grid grid-cols-1 gap-3">
              {mediaFiles.map((file, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0">
                    {getFileIcon(file)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {file.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatFileSize(file.size)} • {file.type.split('/')[1].toUpperCase()}
                    </div>
                  </div>
                  {file.type.startsWith('image/') && (
                    <div className="flex-shrink-0">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeMedia(index)}
                    className="flex-shrink-0 w-6 h-6 bg-red-100 hover:bg-red-200 rounded-full flex items-center justify-center text-red-600 transition-colors duration-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Video Uploader Modal */}
        {showVideoUploader && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-900">Upload Video</h4>
              <button
                type="button"
                onClick={() => setShowVideoUploader(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <VideoUploader
              onUploadComplete={(url, key) => {
                setVideoUrl(url)
                setVideoKey(key)
                setShowVideoUploader(false)
                toast.success('Video uploaded! You can now publish your post.')
              }}
              onUploadError={(error) => {
                toast.error(error)
              }}
              maxSizeMB={500}
            />
          </div>
        )}

        {/* Video Preview */}
        {videoUrl && !showVideoUploader && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-900">Video Attached</h4>
              <button
                type="button"
                onClick={() => {
                  setVideoUrl('')
                  setVideoKey('')
                }}
                className="text-red-600 hover:text-red-700 text-sm"
              >
                Remove Video
              </button>
            </div>
            <div className="relative bg-black rounded-lg overflow-hidden">
              <video
                src={videoUrl}
                controls
                className="w-full max-h-64 object-contain"
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-4 border-t border-gray-200 space-y-3 sm:space-y-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            {/* Media Upload Options */}
            <label
              className={`flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 rounded-lg cursor-pointer transition-colors duration-200 ${
                mediaFiles.length >= 4
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-600 hover:text-[#f97316] hover:bg-primary-50'
              }`}
              title="Upload images (Max 4 images, 10MB each)"
            >
              <Image className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-xs sm:text-sm">Images</span>
              <span className="text-xs text-gray-400 hidden sm:inline">(10MB max)</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleMediaUpload}
                className="hidden"
                disabled={mediaFiles.length >= 4 || uploading || isSubmitting}
              />
            </label>

            {/* Video Upload Button */}
            <button
              type="button"
              onClick={() => setShowVideoUploader(!showVideoUploader)}
              disabled={videoUrl !== '' || uploading || isSubmitting}
              className={`flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 rounded-lg transition-colors duration-200 ${
                videoUrl !== '' || uploading || isSubmitting
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-600 hover:text-[#f97316] hover:bg-primary-50'
              }`}
              title="Upload video (Max 500MB - 5-10 min HD video)"
            >
              <Film className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-xs sm:text-sm">{videoUrl ? 'Video Added' : 'Video'}</span>
              {!videoUrl && <span className="text-xs text-gray-400 hidden sm:inline">(500MB max)</span>}
            </button>
            
            {mediaFiles.length >= 4 && (
              <span className="text-xs text-gray-500">Max 4 files</span>
            )}

            <div className="w-px h-6 bg-gray-300"></div>

            {/* Location (Future feature) */}
            <button
              type="button"
              className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-[#f97316] hover:bg-primary-50 rounded-lg transition-colors duration-200"
              disabled
            >
              <MapPin className="w-5 h-5" />
              <span className="text-sm">Location</span>
            </button>
          </div>

          <div className="flex items-stretch sm:items-center gap-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="btn-secondary order-2 sm:order-1 flex-1"
                disabled={isSubmitting}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={!title.trim() || !content.trim() || isSubmitting || uploading}
              className="btn-primary flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed order-1 sm:order-2 flex-1"
            >
              <Send className="w-4 h-4" />
              <span>
                {uploading ? 'Uploading...' : isSubmitting ? 'Posting...' : 'Post'}
              </span>
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

export default CreatePost







