import type { ChatAttachment } from "@/features/chat/services/supabaseMessagingService"
import { supabase } from '@/lib/supabase'

export interface FileUploadResult extends ChatAttachment {
  id: string
  name: string
  url: string
  type: 'image' | 'video' | 'file'
  size: number
  mimeType: string
  /** The original File object needed for uploading */
  file?: File
  /** Local blob preview URL (only valid in current session) */
  previewUrl?: string
}

const createId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2)
}

const resolveType = (mime: string): ChatAttachment['type'] => {
  if (!mime) return 'file'
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  return 'file'
}

const createPreviewUrl = (file: File): string => {
  if (typeof window === 'undefined') return ''
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return ''
  return URL.createObjectURL(file)
}

export const fileUploadService = {
  /**
   * Create FileUploadResult entries from selected files.
   * Stores both a local preview URL and the original File object for later upload.
   */
  async fromFiles(files: FileList | File[]): Promise<FileUploadResult[]> {
    const list = Array.from(files)
    return list.map((file) => {
      const previewUrl = createPreviewUrl(file)
      return {
        id: createId(),
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        type: resolveType(file.type),
        url: previewUrl, // temporary preview; replaced after upload
        previewUrl,
        file, // keep reference for actual upload
      }
    })
  },

  /**
   * Upload files to Backblaze B2 via the Supabase Edge Function.
   * Returns new FileUploadResult array with public URLs replacing blob URLs.
   */
  async uploadFiles(results: FileUploadResult[]): Promise<FileUploadResult[]> {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token
    if (!token) {
      throw new Error('You must be logged in to upload files')
    }

    const uploaded: FileUploadResult[] = []

    for (const result of results) {
      if (!result.file) {
        // No File object — keep as-is (shouldn't happen)
        uploaded.push(result)
        continue
      }

      const folder = 'chat-media'

      const formData = new FormData()
      formData.append('file', result.file)
      formData.append('folder', folder)

      const uploadResponse = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/upload-to-b2`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      )

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.details || `Failed to upload ${result.name}`)
      }

      const { publicUrl } = await uploadResponse.json()

      if (!publicUrl) {
        throw new Error(`No public URL returned for ${result.name}`)
      }

      uploaded.push({
        ...result,
        url: publicUrl,
        file: undefined, // drop the File reference after upload
      })
    }

    return uploaded
  },

  revokePreviews(results: FileUploadResult[]): void {
    if (typeof window === 'undefined') return
    if (typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return
    results.forEach((result) => {
      const blobUrl = result.previewUrl || result.url
      if (blobUrl && blobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrl)
      }
    })
  },
}
