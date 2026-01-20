'use client'

import React from 'react'
import { FileText, Download, Image, Video, File, FileType, Calendar, User, Folder } from 'lucide-react'
import { GroupPost } from '@/shared/hooks/useGroupPosts'
import { formatDistanceToNow } from 'date-fns'

interface GroupFilesListProps {
  posts: GroupPost[]
  loading: boolean
}

interface FileItem {
  url: string
  name: string
  type: string
  size?: number
  post: GroupPost
}

const GroupFilesList: React.FC<GroupFilesListProps> = ({ posts, loading }) => {
  // Extract files from posts
  // For now, we'll treat media_urls as files, but in production you might have a separate files field
  const files: FileItem[] = posts
    .filter(post => post.media_urls && post.media_urls.length > 0)
    .flatMap(post => 
      (post.media_urls || []).map(url => {
        const fileName = url.split('/').pop() || 'file'
        const extension = fileName.split('.').pop()?.toLowerCase() || ''
        
        return {
          url,
          name: fileName,
          type: extension,
          post
        }
      })
    )

  const getFileIcon = (type: string) => {
    if (type.match(/jpg|jpeg|png|gif|webp|svg/i)) {
      return <Image className="w-5 h-5 text-blue-500" />
    }
    if (type.match(/mp4|webm|mov|avi/i)) {
      return <Video className="w-5 h-5 text-purple-500" />
    }
    if (type.match(/pdf/i)) {
      return <FileText className="w-5 h-5 text-red-500" />
    }
    return <File className="w-5 h-5 text-gray-500" />
  }

  const getFileTypeLabel = (type: string) => {
    if (type.match(/jpg|jpeg|png|gif|webp|svg/i)) return 'Image'
    if (type.match(/mp4|webm|mov|avi/i)) return 'Video'
    if (type.match(/pdf/i)) return 'PDF'
    if (type.match(/doc|docx/i)) return 'Word Document'
    if (type.match(/xls|xlsx/i)) return 'Excel Spreadsheet'
    if (type.match(/zip|rar|7z/i)) return 'Archive'
    return type.toUpperCase() || 'File'
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-12">
        <Folder className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No files yet</h3>
        <p className="text-gray-500">
          Files shared in group posts will appear here
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {files.length} {files.length === 1 ? 'file' : 'files'}
        </h3>
      </div>

      <div className="space-y-2">
        {files.map((file, index) => (
          <div
            key={`${file.post.id}-${index}`}
            className="bg-gray-50 hover:bg-gray-100 rounded-lg p-4 transition-colors"
          >
            <div className="flex items-center gap-4">
              {/* File Icon */}
              <div className="flex-shrink-0">
                {getFileIcon(file.type)}
              </div>

              {/* File Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-medium text-gray-900 truncate">{file.name}</h4>
                  <span className="text-xs text-gray-500 ml-2">{getFileTypeLabel(file.type)}</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    <span className="truncate">
                      {file.post.author?.full_name || file.post.author?.username || 'Unknown'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {formatDistanceToNow(new Date(file.post.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">From: {file.post.title}</span>
                </div>
              </div>

              {/* Download Button */}
              <a
                href={file.url}
                download={file.name}
                className="flex-shrink-0 p-2 hover:bg-gray-200 rounded-lg transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Download className="w-5 h-5 text-gray-600" />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default GroupFilesList

