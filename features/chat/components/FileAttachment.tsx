import React, { useRef } from 'react'
import { fileUploadService, FileUploadResult } from '@/shared/services/fileUploadService'

interface FileAttachmentProps {
  isOpen: boolean
  onClose: () => void
  onFilesSelected: (files: FileUploadResult[]) => void
}

const FileAttachment: React.FC<FileAttachmentProps> = ({ isOpen, onClose, onFilesSelected }) => {
  const inputRef = useRef<HTMLInputElement | null>(null)

  const handleSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = event.target
    if (!files || files.length === 0) return
    const results = await fileUploadService.fromFiles(files)
    if (results.length) {
      onFilesSelected(results)
    }
    event.target.value = ''
  }

  const handleClick = () => {
    inputRef.current?.click()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-content">Attach files</h3>
        <p className="mt-2 text-sm text-content-secondary">Images and videos upload best under 10 MB.</p>

        <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface-canvas p-6 text-center">
          <svg
            aria-hidden
            className="h-10 w-10 text-primary-500"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            viewBox="0 0 24 24"
          >
            <path
              d="M3 16.5V8a3 3 0 0 1 3-3h6l6 6v5.5a3 3 0 0 1-3 3H9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="m8 17 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="mt-3 text-sm text-content-secondary">
            Drag and drop files here or
            <button onClick={handleClick} className="ml-1 font-medium text-primary-600 hover:text-primary-700">
              browse
            </button>
          </p>
          <p className="text-xs text-content-tertiary">Supported types: images, videos, documents</p>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-content-secondary hover:bg-surface-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleClick}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            Choose Files
          </button>
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleSelect}
        />
      </div>
    </div>
  )
}

export default FileAttachment
