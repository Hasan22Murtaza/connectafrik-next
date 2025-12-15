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
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">Attach files</h3>
        <p className="mt-2 text-sm text-gray-500">Images and videos upload best under 10 MB.</p>

        <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
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
          <p className="mt-3 text-sm text-gray-600">
            Drag and drop files here or
            <button onClick={handleClick} className="ml-1 font-medium text-primary-600 hover:text-primary-700">
              browse
            </button>
          </p>
          <p className="text-xs text-gray-400">Supported types: images, videos, documents</p>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
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
