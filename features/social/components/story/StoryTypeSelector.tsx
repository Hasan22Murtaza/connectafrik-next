import React from 'react'
import { Camera, FileText } from 'lucide-react'

export type StoryType = 'photo' | 'text' | null

interface StoryTypeSelectorProps {
  onSelect: (type: StoryType) => void
  userAvatar?: string
  userName?: string
}

const StoryTypeSelector: React.FC<StoryTypeSelectorProps> = ({
  onSelect,
  userAvatar,
  userName = 'User'
}) => {
  return (
    <div className="flex flex-col items-center justify-center h-full py-12 px-4">
      <div className="text-center mb-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Create Your Story</h2>
        <p className="text-gray-500">Choose how you want to share your moment</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 w-full max-w-md sm:max-w-none justify-center">
        <button
          onClick={() => onSelect('photo')}
          className="group relative w-full sm:w-56 h-64 rounded-2xl overflow-hidden bg-white border-2 border-gray-200 hover:border-primary-500 hover:shadow-xl transition-all duration-300"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-500 to-primary-600" />
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
            <div className="w-20 h-20 rounded-2xl bg-primary-50 flex items-center justify-center mb-5 group-hover:bg-primary-100 group-hover:scale-110 transition-all duration-300">
              <Camera className="w-10 h-10 text-primary-600" />
            </div>
            <h3 className="text-gray-900 font-bold text-lg mb-1">Photo Story</h3>
            <p className="text-gray-500 text-sm text-center">Share photos or videos</p>
          </div>
          <div className="absolute inset-0 bg-primary-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>

        <button
          onClick={() => onSelect('text')}
          className="group relative w-full sm:w-56 h-64 rounded-2xl overflow-hidden bg-white border-2 border-gray-200 hover:border-green-500 hover:shadow-xl transition-all duration-300"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 to-emerald-500" />
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
            <div className="w-20 h-20 rounded-2xl bg-green-50 flex items-center justify-center mb-5 group-hover:bg-green-100 group-hover:scale-110 transition-all duration-300">
              <FileText className="w-10 h-10 text-green-600" />
            </div>
            <h3 className="text-gray-900 font-bold text-lg mb-1">Text Story</h3>
            <p className="text-gray-500 text-sm text-center">Share your thoughts</p>
          </div>
          <div className="absolute inset-0 bg-green-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </div>

      <div className="mt-10 flex items-center gap-3 bg-gray-100 rounded-full px-4 py-2">
        <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-semibold overflow-hidden">
          {userAvatar ? (
            <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
          ) : (
            userName.charAt(0).toUpperCase()
          )}
        </div>
        <span className="text-sm text-gray-600">
          Posting as <span className="text-gray-900 font-medium">{userName}</span>
        </span>
      </div>
    </div>
  )
}

export default StoryTypeSelector
