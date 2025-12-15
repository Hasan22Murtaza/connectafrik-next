import React from 'react'
import type { FileUploadResult } from '@/shared/services/fileUploadService'

interface FilePreviewProps {
  files: FileUploadResult[]
  onRemove: (index: number) => void
}

const iconForType = (type: FileUploadResult['type']) => {
  switch (type) {
    case 'image':
      return (
        <svg className="h-6 w-6 text-primary-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14l-6-6-4 4-8-8Z" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="8" cy="8" r="1.5" />
        </svg>
      )
    case 'video':
      return (
        <svg className="h-6 w-6 text-primary-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h5A2.5 2.5 0 0 1 14 6.5v11A2.5 2.5 0 0 1 11.5 20h-5A2.5 2.5 0 0 1 4 17.5Z" />
          <path d="m14 9 6-3v12l-6-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    default:
      return (
        <svg className="h-6 w-6 text-primary-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path d="M6 2h7l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13 2v5h5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
  }
}

const FilePreview: React.FC<FilePreviewProps> = ({ files, onRemove }) => {
  if (!files.length) return null

  return (
    <div className="mt-3 space-y-2">
      {files.map((file, index) => (
        <div
          key={file.id}
          className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2"
        >
          <div className="flex items-center gap-3">
            {iconForType(file.type)}
            <div>
              <p className="text-sm font-medium text-gray-900">{file.name}</p>
              <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
            aria-label={`Remove ${file.name}`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path d="m6 6 12 12" strokeLinecap="round" strokeLinejoin="round" />
              <path d="m18 6-12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}

export default FilePreview
