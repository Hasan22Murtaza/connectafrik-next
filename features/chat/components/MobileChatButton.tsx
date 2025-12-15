import React, { useState } from 'react'
import { MessageCircle, X } from 'lucide-react'
import { useProductionChat } from '@/contexts/ProductionChatContext'
import { useMembers } from '@/shared/hooks/useMembers'

const MobileChatButton: React.FC = () => {
  const [showContacts, setShowContacts] = useState(false)
  const { startChatWithMembers, currentUser } = useProductionChat()
  const { members } = useMembers()

  const availableMembers = members.filter(m => m.id !== currentUser?.id)

  const handleStartChat = async (memberId: string) => {
    const member = members.find(m => m.id === memberId)
    if (!member) return

    await startChatWithMembers([{
      id: member.id,
      name: member.name || 'User'
    }], { participant_ids: [member.id] })
    
    setShowContacts(false)
  }

  return (
    <>
      {/* Floating Chat Button - Always Visible on LEFT side (hamburger is on right) */}
      <button
        onClick={() => setShowContacts(!showContacts)}
        className="fixed bottom-20 left-4 z-[150] w-14 h-14 bg-primary-600 hover:bg-primary-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all md:hidden"
        aria-label="Open chat"
      >
        {showContacts ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      {/* Contacts List Modal */}
      {showContacts && (
        <div className="fixed inset-0 z-[140] bg-black/50 md:hidden" onClick={() => setShowContacts(false)}>
          <div 
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl max-h-[70vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Start a Chat</h3>
                <button
                  onClick={() => setShowContacts(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Contacts List */}
            <div className="overflow-y-auto max-h-[calc(70vh-80px)]">
              {availableMembers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <MessageCircle className="w-12 h-12 text-gray-300 mb-3" />
                  <p className="text-gray-500 text-sm">No members available</p>
                  <p className="text-gray-400 text-xs mt-1">Check back later</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {availableMembers.map((member) => (
                    <button
                      key={member.id}
                      onClick={() => handleStartChat(member.id)}
                      className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors"
                    >
                      {member.avatar_url ? (
                        <img
                          src={member.avatar_url}
                          alt={member.name || 'User'}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="text-primary-600 font-semibold text-lg">
                            {(member.name || 'U')[0].toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 text-left">
                        <p className="font-medium text-gray-900">{member.name || 'User'}</p>
                        <p className="text-sm text-gray-500">ConnectAfrik User</p>
                      </div>
                      <MessageCircle className="w-5 h-5 text-gray-400" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default MobileChatButton

