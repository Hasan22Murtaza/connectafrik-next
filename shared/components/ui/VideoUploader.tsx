import { useFileUpload } from '@/shared/hooks/useFileUpload'
import { AlertCircle, CheckCircle, Film, Loader, Upload, X } from 'lucide-react'
import React, { useCallback, useRef, useState } from 'react'
import toast from 'react-hot-toast'

interface VideoUploaderProps {
  onUploadComplete: (url: string, key: string) => void
  onUploadStart?: () => void
  onUploadError?: (error: string) => void
  maxSizeMB?: number
  className?: string
}

const VideoUploader: React.FC<VideoUploaderProps> = ({
  onUploadComplete,
  onUploadStart,
  onUploadError,
  maxSizeMB = 500, // 500MB default max
  className = ''
}) => {
  const { uploadFile, uploading } = useFileUpload()
  const [isDragging, setIsDragging] = useState(false)
  const [progress, setProgress] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const acceptedFormats = [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime', // .mov
    'video/x-msvideo', // .avi
  ]

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

  const validateFile = (file: File): string | null => {
    // Check file type
    if (!acceptedFormats.includes(file.type)) {
      return 'Please upload a valid video file (MP4, WebM, OGG, MOV, AVI)'
    }

    // Check file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024
    if (file.size > maxSizeBytes) {
      return `File size exceeds ${maxSizeMB}MB limit. Your file is ${formatFileSize(file.size)}`
    }

    return null
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleFileSelect = useCallback((file: File) => {
    // Validate file
    const error = validateFile(file)
    if (error) {
      setUploadError(error)
      toast.error(error)
      return
    }

    setSelectedFile(file)
    setUploadError(null)

    // Create preview URL
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
  }, [maxSizeMB])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }, [handleFileSelect])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }, [handleFileSelect])

  const handleUpload = async () => {
    if (!selectedFile) return

    setProgress(0)
    setUploadError(null)

    if (onUploadStart) {
      onUploadStart()
    }

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 500)

      const result = await uploadFile(selectedFile, {
        bucket: 'post-videos',
        compress: false, // Don't compress videos
        maxSize: maxSizeMB * 1024 * 1024
      })

      clearInterval(progressInterval)
      setProgress(100)

      if (result.error) {
        throw new Error(result.error)
      }

      if (!result.url) {
        throw new Error('No URL returned from upload')
      }

      toast.success('Video uploaded successfully!')
      
      // Extract key from URL for compatibility
      const key = result.url.split('/').pop() || 'unknown'
      onUploadComplete(result.url, key)

      // Cleanup
      setTimeout(() => {
        handleCancel()
      }, 1000)
    } catch (error) {
      console.error('Upload error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload video'
      setUploadError(errorMessage)
      toast.error(errorMessage)

      if (onUploadError) {
        onUploadError(errorMessage)
      }
    }
  }

  const handleCancel = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setSelectedFile(null)
    setPreviewUrl(null)
    setProgress(0)
    setUploadError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleBrowseClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className={`w-full ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedFormats.join(',')}
        onChange={handleInputChange}
        className="hidden"
      />

      {!selectedFile ? (
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleBrowseClick}
          className={`relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-300 hover:border-primary-400 bg-gray-50'
          }`}
        >
          <div className="flex flex-col items-center space-y-4">
            <div className={`p-4 rounded-full ${isDragging ? 'bg-primary-100' : 'bg-gray-100'}`}>
              <Upload className={`w-8 h-8 ${isDragging ? 'text-primary-600' : 'text-gray-400'}`} />
            </div>

            <div>
              <p className="text-lg font-medium text-gray-900">
                {isDragging ? 'Drop video here' : 'Upload Video'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Drag and drop or click to browse
              </p>
            </div>

            <div className="text-xs text-gray-500 space-y-1">
              <p>Supported formats: MP4, WebM, OGG, MOV, AVI</p>
              <p>Maximum size: {maxSizeMB}MB</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Video Preview */}
          <div className="relative bg-black rounded-lg overflow-hidden">
            <video
              src={previewUrl!}
              controls
              className="w-full max-h-96 object-contain"
            />
            {!uploading && (
              <button
                onClick={handleCancel}
                className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-opacity-70 rounded-full text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* File Info */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <Film className="w-5 h-5 text-primary-600" />
              <div>
                <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
              </div>
            </div>

            {uploadError && (
              <AlertCircle className="w-5 h-5 text-red-500" />
            )}
            {progress === 100 && !uploadError && (
              <CheckCircle className="w-5 h-5 text-green-500" />
            )}
          </div>

          {/* Upload Progress */}
          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Uploading...</span>
                <span className="font-medium text-primary-600">{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-primary-600 transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {uploadError && (
            <div className="flex items-start space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{uploadError}</p>
            </div>
          )}

          {/* Action Buttons */}
          {!uploading && progress !== 100 && (
            <div className="flex space-x-3">
              <button
                onClick={handleUpload}
                className="flex-1 bg-primary-600 text-white py-2.5 px-4 rounded-lg hover:bg-primary-700 transition-colors font-medium"
              >
                Upload Video
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Uploading State */}
          {uploading && (
            <div className="flex items-center justify-center space-x-2 py-2 text-gray-600">
              <Loader className="w-4 h-4 animate-spin" />
              <span className="text-sm">Please wait, uploading video...</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default VideoUploader
