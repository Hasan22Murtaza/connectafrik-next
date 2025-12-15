import type { ChatAttachment } from "@/messagingService"

export interface FileUploadResult extends ChatAttachment {}

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
    return list.map((file) => ({
      id: createId(),
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      type: resolveType(file.type),
      url: createPreviewUrl(file),
    }))
  },

  revokePreviews(results: FileUploadResult[]): void {
    if (typeof window === 'undefined') return
    if (typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return
    results.forEach((result) => {
      if (result.url) {
        URL.revokeObjectURL(result.url)
      }
    })
  },
}
