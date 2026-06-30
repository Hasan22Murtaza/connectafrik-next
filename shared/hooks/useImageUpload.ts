import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { uploadFileToBunny, deleteFileFromBunny } from '@/shared/lib/uploadClient'

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

      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file')
        setUploadProgress({ progress: 0, status: 'error' })
        return null
      }

      if (file.size > 10 * 1024 * 1024) {
        toast.error('Image must be less than 10MB')
        setUploadProgress({ progress: 0, status: 'error' })
        return null
      }

      const compressedFile = await compressImage(file)

      const { publicUrl } = await uploadFileToBunny(compressedFile, {
        folder,
        onProgress: ({ percent }) => {
          setUploadProgress({ progress: percent, status: 'uploading' })
        },
      })

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

      return await deleteFileFromBunny(imageUrl)
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

const compressImage = async (file: File): Promise<File> => {
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
          0.85
        )
      }
    }
  })
}
