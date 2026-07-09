import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  uploadFileToBunny,
  deleteFileFromBunny,
  type UploadProgress,
} from '@/shared/lib/uploadClient'

export interface FileUploadOptions {
  bucket: 'user-avatars' | 'post-images' | 'post-videos' | 'post-audio'
  maxSize?: number
  allowedTypes?: string[]
  compress?: boolean
  onProgress?: (progress: UploadProgress) => void
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

      const maxSize = options.maxSize || getDefaultMaxSize(options.bucket)
      if (file.size > maxSize) {
        throw new Error(`File size must be less than ${formatFileSize(maxSize)}`)
      }

      const allowedTypes = options.allowedTypes || getDefaultAllowedTypes(options.bucket)
      if (!allowedTypes.includes(file.type)) {
        throw new Error(`File type ${file.type} is not allowed`)
      }

      let fileToUpload = file
      if (options.compress && file.type.startsWith('image/')) {
        fileToUpload = await compressImage(file)
      }

      const folder = mapBucketToFolder(options.bucket)

      const { publicUrl } = await uploadFileToBunny(fileToUpload, {
        folder,
        onProgress: options.onProgress,
      })

      return {
        url: publicUrl,
        error: null,
        loading: false,
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'File upload failed'
      console.error('Upload failed:', {
        fileName: file.name,
        size: file.size,
        type: file.type,
        error: errorMessage,
      })

      return {
        url: null,
        error: errorMessage,
        loading: false,
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

  const deleteFile = async (url: string, _bucket?: string): Promise<boolean> => {
    if (!user) return false
    return deleteFileFromBunny(url)
  }

  return {
    uploadFile,
    uploadMultipleFiles,
    deleteFile,
    uploading
  }
}

const getDefaultMaxSize = (bucket: string): number => {
  switch (bucket) {
    case 'user-avatars':
      return 5 * 1024 * 1024
    case 'post-images':
      return 10 * 1024 * 1024
    case 'post-videos':
      return 500 * 1024 * 1024
    case 'post-audio':
      return 50 * 1024 * 1024
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
            resolve(file)
          }
        },
        file.type,
        quality
      )
    }

    img.src = URL.createObjectURL(file)
  })
}

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
