import React from 'react'
import type { FileUploadResult } from '@/shared/services/fileUploadService'
import { X } from 'lucide-react'

interface FilePreviewProps {
  files: FileUploadResult[]
  onRemove: (index: number) => void
}

const FilePreview: React.FC<FilePreviewProps> = ({ files, onRemove }) => {
  if (!files.length) return null

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {files.map((file, index) => {
        const previewSrc = file.previewUrl || file.url

        if (file.type === 'image' && previewSrc) {
          return (
            <div key={file.id} className="relative group">
              <img
                src={previewSrc}
                alt={file.name}
                className="h-16 w-16 rounded-lg object-cover border border-gray-200"
              />
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-sm hover:bg-red-600"
                aria-label={`Remove ${file.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )
        }

        if (file.type === 'video' && previewSrc) {
          return (
            <div key={file.id} className="relative group">
              <video
                src={previewSrc}
                className="h-16 w-16 rounded-lg object-cover border border-gray-200"
                muted
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-black/50">
                  <svg className="h-3 w-3 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-sm hover:bg-red-600"
                aria-label={`Remove ${file.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )
        }

        // Generic file
        return (
          <div
            key={file.id}
            className="relative flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
          >
            <svg className="h-5 w-5 text-primary-600 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path d="M6 2h7l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M13 2v5h5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate max-w-[100px]">{file.name}</p>
              <p className="text-[10px] text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="ml-1 flex h-5 w-5 items-center justify-center rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-600"
              aria-label={`Remove ${file.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

export default FilePreview
