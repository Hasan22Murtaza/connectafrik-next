import type { ChatAttachment } from "@/features/chat/services/supabaseMessagingService"
import { uploadFileToBunny } from '@/shared/lib/uploadClient'

export interface FileUploadResult extends ChatAttachment {
  id: string
  name: string
  url: string
  type: 'image' | 'video' | 'file'
  size: number
  mimeType: string
  file?: File
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
        url: previewUrl,
        previewUrl,
        file,
      }
    })
  },

  async uploadFiles(results: FileUploadResult[]): Promise<FileUploadResult[]> {
    const uploaded: FileUploadResult[] = []

    for (const result of results) {
      if (!result.file) {
        uploaded.push(result)
        continue
      }

      const { publicUrl } = await uploadFileToBunny(result.file, {
        folder: 'chat-media',
      })

      uploaded.push({
        ...result,
        url: publicUrl,
        file: undefined,
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
