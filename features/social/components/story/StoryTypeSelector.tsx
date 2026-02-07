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
    <div className="flex flex-col items-center justify-center w-full h-full px-4 sm:px-6 py-6 sm:py-12">
      <div className="text-center mb-5 sm:mb-10">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1 sm:mb-2">Create Your Story</h2>
        <p className="text-gray-500 text-xs sm:text-sm">Choose how you want to share your moment</p>
      </div>

      <div className="flex flex-row gap-3 sm:gap-6 w-full max-w-sm sm:max-w-none justify-center">
        <button
          onClick={() => onSelect('photo')}
          className="group relative flex-1 sm:flex-none sm:w-56 h-56 sm:h-72 rounded-2xl overflow-hidden active:scale-[0.97] transition-all duration-300 shadow-lg hover:shadow-xl"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary-500 via-primary-600 to-orange-500" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 sm:p-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4 sm:mb-5 group-hover:scale-110 transition-transform duration-300">
              <Camera className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            </div>
            <h3 className="text-white font-bold text-lg sm:text-xl mb-1">Photo Story</h3>
            <p className="text-white/80 text-xs sm:text-sm text-center">Share photos or videos</p>
          </div>
          <div className="absolute top-4 right-4 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/10 opacity-60" />
          <div className="absolute bottom-6 left-4 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white/10 opacity-40" />
        </button>

        <button
          onClick={() => onSelect('text')}
          className="group relative flex-1 sm:flex-none sm:w-56 h-56 sm:h-72 rounded-2xl overflow-hidden active:scale-[0.97] transition-all duration-300 shadow-lg hover:shadow-xl"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 sm:p-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4 sm:mb-5 group-hover:scale-110 transition-transform duration-300">
              <FileText className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            </div>
            <h3 className="text-white font-bold text-lg sm:text-xl mb-1">Text Story</h3>
            <p className="text-white/80 text-xs sm:text-sm text-center">Share your thoughts</p>
          </div>
          <div className="absolute top-6 left-5 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white/10 opacity-50" />
          <div className="absolute bottom-4 right-5 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white/10 opacity-30" />
        </button>
      </div>

      <div className="mt-6 sm:mt-10 flex items-center gap-2.5 bg-gray-100 rounded-full px-3.5 py-2">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-xs sm:text-sm font-semibold overflow-hidden">
          {userAvatar ? (
            <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
          ) : (
            userName.charAt(0).toUpperCase()
          )}
        </div>
        <span className="text-xs sm:text-sm text-gray-600">
          Posting as <span className="text-gray-900 font-medium">{userName}</span>
        </span>
      </div>
    </div>
  )
}

export default StoryTypeSelector
