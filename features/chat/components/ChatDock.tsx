import React from 'react'
import ReactDOM from 'react-dom'
import { useProductionChat } from '@/contexts/ProductionChatContext'
import ChatWindow from './ChatWindow'
import { ChatThread } from '@/features/chat/services/supabaseMessagingService'

const ChatDock: React.FC = () => {
  const {
    dockedThreadIds,
    minimizedThreadIds,
    closeThread,
    minimizeThread,
    openThread,
    getThreadById,
  } = useProductionChat()

  if (!dockedThreadIds || dockedThreadIds.length === 0) return null

  const minimizedThreads = minimizedThreadIds.reduce<ChatThread[]>((acc, threadId) => {
    const thread = getThreadById(threadId)
    if (thread) {
      acc.push(thread)
    }
    return acc
  }, [])

  return ReactDOM.createPortal(
    <div className="fixed bottom-4 right-4 z-[200] sm:bottom-6 sm:right-6">
      <div className="flex max-w-full items-end justify-end gap-4">
        {dockedThreadIds
          .filter((threadId) => !minimizedThreadIds.includes(threadId))
          .map((threadId) => (
            <div key={threadId} className="pointer-events-auto">
              <ChatWindow threadId={threadId} onClose={closeThread} onMinimize={minimizeThread} />
            </div>
          ))}

        {minimizedThreads.length > 0 && (
          <div className="pointer-events-auto w-64 rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">Chats</p>
                <p className="text-xs text-gray-500">Double-click to reopen</p>
              </div>
              <span className="text-xs text-gray-400">{minimizedThreads.length}</span>
            </div>
            <div className="py-2">
              {minimizedThreads.map((thread) => (
                <div
                  key={thread.id}
                  onDoubleClick={() => openThread(thread.id)}
                  className="flex w-full cursor-pointer items-center justify-between px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <span className="truncate">{thread.name || 'Unnamed Chat'}</span>
                  <div className="flex items-center gap-2">
                    {thread.unread_count && thread.unread_count > 0 && (
                      <span className="inline-flex items-center justify-center rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">
                        {thread.unread_count}
                      </span>
                    )}
                    <button
                      onClick={(event) => {
                        event.stopPropagation()
                        openThread(thread.id)
                      }}
                      className="text-xs text-gray-400 hover:text-primary-600"
                    >
                      Open
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

export default ChatDock



