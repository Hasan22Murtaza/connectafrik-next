'use client'

import React, { useState } from 'react'
import { Image, Send, X, Upload, FileText, Target, Megaphone, Calendar, BookOpen } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/shared/hooks/useProfile'
import { useFileUpload } from '@/shared/hooks/useFileUpload'
import toast from 'react-hot-toast'

interface CreateGroupPostProps {
  onSubmit: (postData: {
    title: string
    content: string
    post_type: 'discussion' | 'goal_update' | 'announcement' | 'event' | 'resource'
    media_urls?: string[]
  }) => void
  onCancel?: () => void
}

const POST_TYPES = [
  { value: 'discussion', label: 'Discussion', icon: FileText, color: 'bg-blue-100 text-blue-700' },
  { value: 'goal_update', label: 'Goal Update', icon: Target, color: 'bg-green-100 text-green-700' },
  { value: 'announcement', label: 'Announcement', icon: Megaphone, color: 'bg-yellow-100 text-yellow-700' },
  { value: 'event', label: 'Event', icon: Calendar, color: 'bg-purple-100 text-purple-700' },
  { value: 'resource', label: 'Resource', icon: BookOpen, color: 'bg-orange-100 text-orange-700' },
]

const CreateGroupPost: React.FC<CreateGroupPostProps> = ({ onSubmit, onCancel }) => {
  const { user } = useAuth()
  const { profile } = useProfile()
  const { uploadMultipleFiles, uploading } = useFileUpload()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [postType, setPostType] = useState<'discussion' | 'goal_update' | 'announcement' | 'event' | 'resource'>('discussion')
  const [mediaFiles, setMediaFiles] = useState<File[]>([])
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    // Limit to 10 files
    const filesToAdd = files.slice(0, 10 - mediaFiles.length)
    setMediaFiles(prev => [...prev, ...filesToAdd])

    // Create previews
    filesToAdd.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) => {
          setMediaPreviews(prev => [...prev, e.target?.result as string])
        }
        reader.readAsDataURL(file)
      }
    })
  }

  const removeMedia = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index))
    setMediaPreviews(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim() || !content.trim()) {
      toast.error('Please fill in all required fields')
      return
    }

    if (title.trim().length < 5) {
      toast.error('Title must be at least 5 characters')
      return
    }

    if (content.trim().length < 10) {
      toast.error('Content must be at least 10 characters')
      return
    }

    if (title.trim().length > 200) {
      toast.error('Title must be less than 200 characters')
      return
    }

    if (content.trim().length > 5000) {
      toast.error('Content must be less than 5000 characters')
      return
    }

    setIsSubmitting(true)
    let media_urls: string[] = []

    try {
      // Upload media files if any
      if (mediaFiles.length > 0) {
        const uploadResults = await uploadMultipleFiles(
          mediaFiles,
          { bucket: 'post-images', compress: true }
        )
        media_urls = uploadResults
          .filter(result => result.url)
          .map(result => result.url as string)
      }

      onSubmit({
        title: title.trim(),
        content: content.trim(),
        post_type: postType,
        media_urls: media_urls.length > 0 ? media_urls : undefined
      })

      // Reset form
      setTitle('')
      setContent('')
      setPostType('discussion')
      setMediaFiles([])
      setMediaPreviews([])
    } catch (error: any) {
      toast.error(error.message || 'Failed to create post')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!user) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500">
        Please log in to create a post
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Post Type Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Post Type</label>
        <div className="grid sm:grid-cols-5 grid-cols-2 gap-2">
          {POST_TYPES.map((type) => {
            const Icon = type.icon
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => setPostType(type.value as any)}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg border-1 transition-all ${
                  postType === type.value
                    ? 'border-orange-400 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Icon className={`w-5 h-5 ${postType === type.value ? 'text-primary-600' : 'text-gray-500'}`} />
                <span className={`text-xs ${postType === type.value ? 'text-primary-600 font-medium' : 'text-gray-600'}`}>
                  {type.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Title */}
      <div>
        <input
          type="text"
          placeholder="What's on your mind?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          maxLength={200}
          required
        />
        <div className="text-right text-xs text-gray-500 mt-1">
          {title.length}/200
        </div>
      </div>

      {/* Content */}
      <div>
        <textarea
          placeholder="Write something..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[100px] resize-none"
          maxLength={5000}
          required
        />
        <div className="text-right text-xs text-gray-500 mt-1">
          {content.length}/5000
        </div>
      </div>

      {/* Media Previews */}
      {mediaPreviews.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {mediaPreviews.map((preview, index) => (
            <div key={index} className="relative group">
              <img
                src={preview}
                alt={`Preview ${index + 1}`}
                className="w-full h-32 object-cover rounded-lg"
              />
              <button
                type="button"
                onClick={() => removeMedia(index)}
                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-200">
        <div className="flex items-center gap-2">
          <label className="cursor-pointer p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <Image className="w-5 h-5 text-gray-600" />
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              disabled={uploading || mediaFiles.length >= 10}
            />
          </label>
          {mediaFiles.length > 0 && (
            <span className="text-sm text-gray-600">
              {mediaFiles.length} file{mediaFiles.length > 1 ? 's' : ''} selected
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting || uploading || !title.trim() || !content.trim()}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Posting...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Post
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  )
}

export default CreateGroupPost

