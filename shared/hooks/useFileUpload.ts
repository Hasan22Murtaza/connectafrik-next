import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { useAuth } from '@/contexts/AuthContext'

export interface FileUploadOptions {
  bucket: 'user-avatars' | 'post-images' | 'post-videos' | 'post-audio'
  maxSize?: number // in bytes
  allowedTypes?: string[]
  compress?: boolean
}

export interface UploadResult {
  url: string | null
  error: string | null
  loading: boolean
}

export const useFileUpload = () => {
  const { user } = useAuth()
  const [uploading, setUploading] = useState(false)

  const uploadFile = async (
    file: File, 
    options: FileUploadOptions
  ): Promise<UploadResult> => {
    setUploading(true)

    try {
      if (!user) {
        throw new Error('User must be authenticated to upload files')
      }

      // Validate file size
      const maxSize = options.maxSize || getDefaultMaxSize(options.bucket)
      if (file.size > maxSize) {
        throw new Error(`File size must be less than ${formatFileSize(maxSize)}`)
      }

      // Validate file type
      const allowedTypes = options.allowedTypes || getDefaultAllowedTypes(options.bucket)
      if (!allowedTypes.includes(file.type)) {
        throw new Error(`File type ${file.type} is not allowed`)
      }

      // Compress file if needed (for images)
      let fileToUpload = file
      if (options.compress && file.type.startsWith('image/')) {
        fileToUpload = await compressImage(file)
      }

      // Get authentication session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !sessionData.session) {
        throw new Error('You must be logged in to upload files')
      }

      // Map bucket to folder for B2
      const folder = mapBucketToFolder(options.bucket)

      // Upload to Backblaze B2 via Edge Function
      const formData = new FormData()
      formData.append('file', fileToUpload)
      formData.append('folder', folder)

      console.log('🚀 Uploading to Backblaze B2...', {
        fileName: file.name,
        size: fileToUpload.size,
        type: fileToUpload.type,
        folder
      })

      const uploadResponse = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/upload-to-b2`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: formData
        }
      )

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({}))
        console.error('❌ Upload Failed:', {
          status: uploadResponse.status,
          statusText: uploadResponse.statusText,
          error: errorData
        })
        throw new Error(errorData.error || errorData.details || 'Upload failed')
      }

      const { publicUrl } = await uploadResponse.json()

      if (!publicUrl) {
        throw new Error('No public URL returned from upload')
      }

      console.log('✅ Upload Successful!', publicUrl)

      return {
        url: publicUrl,
        error: null,
        loading: false
      }

    } catch (error: any) {
      const errorMessage = error?.message || 'File upload failed'
      console.error('❌ Upload failed and no fallback for this file type:', {
        fileName: file.name,
        size: file.size,
        type: file.type,
        error: errorMessage
      })

      return {
        url: null,
        error: errorMessage,
        loading: false
      }
    } finally {
      setUploading(false)
    }
  }

  const uploadMultipleFiles = async (
    files: File[],
    options: FileUploadOptions
  ): Promise<UploadResult[]> => {
    const uploadPromises = files.map(file => uploadFile(file, options))
    return Promise.all(uploadPromises)
  }

  const deleteFile = async (url: string, bucket: string): Promise<boolean> => {
    try {
      if (!user) return false

      // Get authentication session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !sessionData.session) {
        throw new Error('You must be logged in to delete files')
      }

      // Extract B2 key from URL
      const key = extractB2Key(url)
      if (!key) {
        throw new Error('Unable to determine storage key for file')
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete-b2-object`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ key })
        }
      )

      if (!response.ok) {
        const errorResponse = await response.json().catch(() => ({}))
        const message = errorResponse.error ?? 'Failed to delete file'
        throw new Error(message)
      }

      return true
    } catch (error) {
      console.error('Error deleting file:', error)
      return false
    }
  }

  return {
    uploadFile,
    uploadMultipleFiles,
    deleteFile,
    uploading
  }
}

// Helper functions
const generateFilePath = (userId: string, extension: string): string => {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 15)
  const date = new Date()
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  
  return `${userId}/${year}/${month}/${timestamp}_${random}.${extension}`
}

const getDefaultMaxSize = (bucket: string): number => {
  switch (bucket) {
    case 'user-avatars':
      return 5 * 1024 * 1024 // 5MB
    case 'post-images':
      return 10 * 1024 * 1024 // 10MB
    case 'post-videos':
      return 500 * 1024 * 1024 // 500MB
    case 'post-audio':
      return 50 * 1024 * 1024 // 50MB
    default:
      return 5 * 1024 * 1024
  }
}

const getDefaultAllowedTypes = (bucket: string): string[] => {
  switch (bucket) {
    case 'user-avatars':
    case 'post-images':
      return ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
    case 'post-videos':
      return ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm']
    case 'post-audio':
      return ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm']
    default:
      return ['image/jpeg', 'image/png']
  }
}

const readFileAsDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.onabort = () => reject(new Error('File reading was aborted'))
    reader.onload = () => resolve(reader.result as string)
    reader.readAsDataURL(file)
  })
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const compressImage = async (file: File, quality: number = 0.8): Promise<File> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      // Calculate new dimensions (max 1920x1080 for posts, 512x512 for avatars)
      const maxWidth = file.type.includes('avatar') ? 512 : 1920
      const maxHeight = file.type.includes('avatar') ? 512 : 1080
      
      let { width, height } = img
      
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height
          height = maxHeight
        }
      }

      canvas.width = width
      canvas.height = height

      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height)
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now()
            })
            resolve(compressedFile)
          } else {
            resolve(file) // Return original if compression fails
          }
        },
        file.type,
        quality
      )
    }

    img.src = URL.createObjectURL(file)
  })
}

// Map Supabase bucket names to B2 folder names
const mapBucketToFolder = (bucket: string): string => {
  switch (bucket) {
    case 'user-avatars':
      return 'profiles'
    case 'post-images':
      return 'posts'
    case 'post-videos':
      return 'reels'
    case 'post-audio':
      return 'uploads'
    default:
      return 'uploads'
  }
}

// Extract B2 key from URL
const extractB2Key = (url: string): string | null => {
  try {
    const trimmed = url.trim()
    if (!trimmed) return null

    if (!trimmed.startsWith('http')) {
      return trimmed.replace(/^\//, '')
    }

    const parsed = new URL(trimmed)
    let path = decodeURIComponent(parsed.pathname.replace(/^\//, ''))

    // Handle different URL formats
    if (parsed.host.includes('.r2.cloudflarestorage.com')) {
      const firstSlash = path.indexOf('/')
      if (firstSlash !== -1) {
        path = path.substring(firstSlash + 1)
      }
    } else if (parsed.host.includes('backblazeb2.com')) {
      // Backblaze B2 format: https://f003.backblazeb2.com/file/bucket-name/path
      const fileIndex = path.indexOf('/file/')
      if (fileIndex !== -1) {
        const afterFile = path.substring(fileIndex + 6) // Skip "/file/"
        const bucketEnd = afterFile.indexOf('/')
        if (bucketEnd !== -1) {
          path = afterFile.substring(bucketEnd + 1)
        }
      }
    }

    return path
  } catch {
    return null
  }
}



