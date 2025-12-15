import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { FiImage, FiVideo, FiX } from 'react-icons/fi'
import { useDropzone } from 'react-dropzone'

const categories = [
  { id: 'politics', label: 'ðŸ—³ï¸ Politics', color: 'bg-blue-100 text-blue-800' },
  { id: 'culture', label: 'ðŸŽ­ Culture', color: 'bg-purple-100 text-purple-800' },
  { id: 'food', label: 'ðŸ² Food', color: 'bg-green-100 text-green-800' },
  { id: 'architecture', label: 'ðŸ›ï¸ Architecture', color: 'bg-yellow-100 text-yellow-800' },
  { id: 'fashion', label: 'ðŸ‘— Fashion', color: 'bg-pink-100 text-pink-800' },
  { id: 'general', label: 'ðŸ’¬ General', color: 'bg-gray-100 text-gray-800' },
]

export default function CreatePost({ onPostCreated }) {
  const [selectedCategory, setSelectedCategory] = useState('general')
  const [mediaFiles, setMediaFiles] = useState([])
  const [loading, setLoading] = useState(false)
  
  const { register, handleSubmit, reset, watch } = useForm()
  const content = watch('content', '')

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
      'video/*': ['.mp4', '.webm', '.ogg'],
    },
    maxFiles: 4,
    onDrop: (acceptedFiles) => {
      setMediaFiles([...mediaFiles, ...acceptedFiles].slice(0, 4))
    },
  })

  const removeMedia = (index) => {
    setMediaFiles(mediaFiles.filter((_, i) => i !== index))
  }

  const uploadMedia = async (file) => {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random()}.${fileExt}`
    const filePath = `posts/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(filePath, file)

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(filePath)

    return publicUrl
  }

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      // Upload media files
      const mediaUrls = await Promise.all(mediaFiles.map(uploadMedia))

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()

      // Create post
      const { error } = await supabase.from('posts').insert({
        user_id: user.id,
        content: data.content,
        category: selectedCategory,
        media_urls: mediaUrls,
      })

      if (error) throw error

      toast.success('Post created successfully!')
      reset()
      setMediaFiles([])
      setSelectedCategory('general')
      if (onPostCreated) onPostCreated()
    } catch (error) {
      toast.error(error.message || 'Failed to create post')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-xl mx-auto">
      <form onSubmit={handleSubmit(onSubmit)}>
        <textarea
          {...register('content', { required: true, maxLength: 500 })}
          className="input-field resize-none h-24 mb-2"
          placeholder="What's on your mind?"
          maxLength={500}
        />
        <div className="text-right text-sm text-gray-500 mt-1">
          {content.length}/500 characters
        </div>

        {/* Category Selection */}
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Select Category</p>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                  selectedCategory === cat.id
                    ? cat.color + ' ring-2 ring-offset-2 ring-purple-500'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Media Upload */}
        <div className="mb-4">
          <div
            {...getRootProps()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-purple-500 transition-colors"
          >
            <input {...getInputProps()} />
            <div className="flex items-center justify-center gap-4 text-gray-500">
              <FiImage size={24} />
              <FiVideo size={24} />
              <p className="text-sm">Drop images/videos here or click to upload (max 4)</p>
            </div>
          </div>

          {/* Media Preview */}
          {mediaFiles.length > 0 && (
            <div className="mt-4 grid grid-cols-4 gap-2">
              {mediaFiles.map((file, index) => (
                <div key={index} className="relative group">
                  {file.type.startsWith('image/') ? (
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`Upload ${index + 1}`}
                      className="w-full h-20 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-full h-20 bg-gray-200 rounded-lg flex items-center justify-center">
                      <FiVideo className="text-gray-500" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeMedia(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <FiX size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              type="button"
              className="text-gray-500 hover:text-purple-600 transition-colors"
            >
              <FiImage size={20} />
            </button>
            <button
              type="button"
              className="text-gray-500 hover:text-purple-600 transition-colors"
            >
              <FiVideo size={20} />
            </button>
          </div>

          <button
            type="submit"
            disabled={loading || !content.trim()}
            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium rounded-lg hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Posting...' : 'Post'}
          </button>
        </div>
      </form>
    </div>
  )
}
        
