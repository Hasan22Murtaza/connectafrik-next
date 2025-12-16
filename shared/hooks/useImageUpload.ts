import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

interface UploadProgress {
  progress: number
  status: 'idle' | 'uploading' | 'success' | 'error'
}

export const useImageUpload = () => {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    progress: 0,
    status: 'idle'
  })

  const uploadImage = async (file: File, folder: string = 'products'): Promise<string | null> => {
    try {
      setUploadProgress({ progress: 0, status: 'uploading' })

      // Validate file
      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file')
        setUploadProgress({ progress: 0, status: 'error' })
        return null
      }

      // Check file size (max 10MB for marketplace)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Image must be less than 10MB')
        setUploadProgress({ progress: 0, status: 'error' })
        return null
      }

      // Compress image if needed
      const compressedFile = await compressImage(file)

      setUploadProgress({ progress: 30, status: 'uploading' })

      // Generate unique filename
      const timestamp = Date.now()
      const randomStr = Math.random().toString(36).substring(2, 15)
      const sanitizedFileName = compressedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const uniqueFileName = `${timestamp}_${randomStr}_${sanitizedFileName}`

      setUploadProgress({ progress: 50, status: 'uploading' })

      // Get authentication session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        throw new Error('Unable to retrieve session')
      }

      const session = sessionData.session
      if (!session) {
        throw new Error('You must be logged in to upload images')
      }

      // Upload to Backblaze B2 via Edge Function (S3-compatible, scalable, affordable)
      const formData = new FormData()
      formData.append('file', compressedFile)
      formData.append('folder', folder)

      console.log('🚀 Uploading to Backblaze B2...', {
        fileName: uniqueFileName,
        size: compressedFile.size,
        type: compressedFile.type,
        folder
      })

      const uploadResponse = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/upload-to-b2`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
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

      setUploadProgress({ progress: 100, status: 'success' })

      return publicUrl
    } catch (error: any) {
      console.error('Error uploading image:', error)
      toast.error(error.message || 'Failed to upload image')
      setUploadProgress({ progress: 0, status: 'error' })
      return null
    }
  }

  const uploadMultipleImages = async (files: File[], folder: string = 'products'): Promise<string[]> => {
    const urls: string[] = []

    for (let i = 0; i < files.length; i++) {
      const url = await uploadImage(files[i], folder)
      if (url) {
        urls.push(url)
      }
      setUploadProgress({
        progress: ((i + 1) / files.length) * 100,
        status: 'uploading'
      })
    }

    setUploadProgress({ progress: 100, status: 'success' })
    return urls
  }

  const deleteImage = async (imageUrl: string): Promise<boolean> => {
    try {
      if (imageUrl.includes('/marketplace/')) {
        const urlParts = imageUrl.split('/marketplace/')
        if (urlParts.length < 2) return false

        const filePath = urlParts[1]

        const { error } = await supabase.storage
          .from('marketplace')
          .remove([filePath])

        if (error) throw error

        return true
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        throw new Error('Unable to retrieve session')
      }

      const session = sessionData.session
      if (!session) {
        throw new Error('You must be logged in to delete images')
      }

      const key = extractB2Key(imageUrl)
      if (!key) {
        throw new Error('Unable to determine storage key for image')
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete-b2-object`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ key })
        }
      )

      if (!response.ok) {
        const errorResponse = await response.json().catch(() => ({}))
        const message = errorResponse.error ?? 'Failed to delete image'
        throw new Error(message)
      }

      return true
    } catch (error: any) {
      console.error('Error deleting image:', error)
      return false
    }
  }

  return {
    uploadImage,
    uploadMultipleImages,
    deleteImage,
    uploadProgress
  }
}

const extractB2Key = (url: string): string | null => {
  try {
    const trimmed = url.trim()
    if (!trimmed) return null

    if (!trimmed.startsWith('http')) {
      return trimmed.replace(/^\//, '')
    }

    const parsed = new URL(trimmed)
    let path = decodeURIComponent(parsed.pathname.replace(/^\//, ''))

    // Handle Backblaze B2 URLs
    if (parsed.host.includes('backblazeb2.com')) {
      // Backblaze B2 format: https://f003.backblazeb2.com/file/bucket-name/path
      const fileIndex = path.indexOf('/file/')
      if (fileIndex !== -1) {
        const afterFile = path.substring(fileIndex + 6) // Skip "/file/"
        const bucketEnd = afterFile.indexOf('/')
        if (bucketEnd !== -1) {
          path = afterFile.substring(bucketEnd + 1)
        }
      }
    } else if (parsed.host.includes('media.connectafrik.com')) {
      // CDN URL format: https://media.connectafrik.com/path
      // Path is already correct
    }

    return path
  } catch {
    return null
  }
}

// Helper function to compress images
const compressImage = async (file: File): Promise<File> => {
  // Return original file if not in browser environment
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return file
  }

  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        // Max dimensions
        const MAX_WIDTH = 1200
        const MAX_HEIGHT = 1200

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width
            width = MAX_WIDTH
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height
            height = MAX_HEIGHT
          }
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
              })
              resolve(compressedFile)
            } else {
              resolve(file)
            }
          },
          'image/jpeg',
          0.85 // Quality
        )
      }
    }
  })
}
