import React from 'react'

interface MessageStatusIndicatorProps {
  status: 'sending' | 'sent' | 'delivered' | 'read'
  isOwnMessage: boolean
}

const MessageStatusIndicator: React.FC<MessageStatusIndicatorProps> = ({ 
  status, 
  isOwnMessage 
}) => {
  // Only show status indicators for own messages
  if (!isOwnMessage) return null

  const getStatusIcon = () => {
    switch (status) {
      case 'sending':
        return (
          <div className="flex items-center">
            <div className="w-3 h-3 border border-gray-400 rounded-full animate-pulse"></div>
          </div>
        )
      case 'sent':
        return (
          <div className="flex items-center">
            <svg 
              className="w-3 h-3 text-gray-400" 
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path 
                fillRule="evenodd" 
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
                clipRule="evenodd" 
              />
            </svg>
          </div>
        )
      case 'delivered':
        return (
          <div className="flex items-center">
            <svg 
              className="w-3 h-3 text-gray-400" 
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path 
                fillRule="evenodd" 
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
                clipRule="evenodd" 
              />
            </svg>
            <svg 
              className="w-3 h-3 text-gray-400 -ml-1" 
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path 
                fillRule="evenodd" 
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
                clipRule="evenodd" 
              />
            </svg>
          </div>
        )
      case 'read':
        return (
          <div className="flex items-center">
            <svg 
              className="w-3 h-3 text-blue-500" 
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path 
                fillRule="evenodd" 
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
                clipRule="evenodd" 
              />
            </svg>
            <svg 
              className="w-3 h-3 text-blue-500 -ml-1" 
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path 
                fillRule="evenodd" 
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
                clipRule="evenodd" 
              />
            </svg>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="flex items-center justify-end mt-1">
      {getStatusIcon()}
    </div>
  )
}

export default MessageStatusIndicator
