import React from 'react'

interface TextOverlayData {
  id: string
  text: string
  x: number
  y: number
  fontSize: number
  fontFamily: string
  color: string
  backgroundColor: string
  align: 'left' | 'center' | 'right'
}

interface StoryPreviewProps {
  type: 'photo' | 'text'
  mediaUrl?: string
  mediaType?: 'image' | 'video'
  gradient?: string
  backgroundColor?: string
  textOverlays: TextOverlayData[]
  caption?: string
  userName: string
  userAvatar?: string
}

const StoryPreview: React.FC<StoryPreviewProps> = ({
  type,
  mediaUrl,
  mediaType = 'image',
  gradient = 'from-blue-600 to-purple-600',
  backgroundColor,
  textOverlays,
  caption,
  userName,
  userAvatar
}) => {
  const backgroundStyle = type === 'text' && backgroundColor ? { backgroundColor } : undefined
  const backgroundClass = type === 'text' && !backgroundColor
    ? `bg-gradient-to-br ${gradient}`
    : type !== 'text' ? 'bg-black' : ''

  return (
    <div className="flex flex-col items-center">
      <p className="text-gray-400 text-sm mb-4">Preview</p>

      <div className="relative">
        <div className="w-[280px] h-[500px] bg-gray-800 rounded-[40px] p-2 shadow-2xl">
          <div className="relative w-full h-full bg-black rounded-[32px] overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-b-2xl z-20" />

            <div className="absolute top-2 left-4 right-4 z-10 flex gap-1">
              <div className="flex-1 h-0.5 bg-white/50 rounded-full overflow-hidden">
                <div className="h-full w-1/2 bg-white rounded-full" />
              </div>
            </div>

            <div className="absolute top-8 left-3 right-3 z-10 flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white text-xs font-semibold ring-2 ring-primary-500">
                {userAvatar ? (
                  <img src={userAvatar} alt={userName} className="w-full h-full rounded-full object-cover" />
                ) : (
                  userName.charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1">
                <p className="text-white text-sm font-semibold drop-shadow-lg">{userName}</p>
                <p className="text-white/70 text-xs drop-shadow">Just now</p>
              </div>
            </div>

            <div className={`absolute inset-0 ${backgroundClass}`} style={backgroundStyle}>
              {type === 'photo' && mediaUrl && (
                mediaType === 'image' ? (
                  <img src={mediaUrl} alt="Story" className="w-full h-full object-cover" />
                ) : (
                  <video src={mediaUrl} className="w-full h-full object-cover" autoPlay muted loop playsInline />
                )
              )}

              {textOverlays.map((overlay) => (
                <div
                  key={overlay.id}
                  className="absolute px-3 py-2 rounded-lg max-w-[90%]"
                  style={{
                    left: `${overlay.x}%`,
                    top: `${overlay.y}%`,
                    transform: 'translate(-50%, -50%)',
                    fontSize: `${overlay.fontSize}px`,
                    fontFamily: overlay.fontFamily,
                    color: overlay.color,
                    backgroundColor: overlay.backgroundColor,
                    textAlign: overlay.align
                  }}
                >
                  {overlay.text || 'Start typing...'}
                </div>
              ))}

              {type === 'text' && textOverlays.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-white/50 text-lg font-medium">Start typing...</p>
                </div>
              )}

              {type === 'photo' && !mediaUrl && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                  <p className="text-white/50 text-sm">Add photo or video</p>
                </div>
              )}
            </div>

            {caption && (
              <div className="absolute bottom-4 left-3 right-3 z-10">
                <p className="text-white text-sm drop-shadow-lg bg-black/30 backdrop-blur-sm rounded-lg px-3 py-2">
                  {caption}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-[40px] pointer-events-none" />
      </div>
    </div>
  )
}

export default StoryPreview
