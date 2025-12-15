'use client'

import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import { useProductionChat } from '@/contexts/ProductionChatContext'
import ChatWindow from './ChatWindow'
import { ChatThread, supabaseMessagingService } from '@/features/chat/services/supabaseMessagingService'

const ChatDock: React.FC = () => {
  const {
    openThreads,
    closeThread,
    openThread,
    currentUser,
  } = useProductionChat()
  
  const [mounted, setMounted] = useState(false)
  const [minimizedThreadIds, setMinimizedThreadIds] = useState<string[]>([])
  const [threads, setThreads] = useState<Map<string, ChatThread>>(new Map())

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const loadThreads = async () => {
      if (currentUser && openThreads.length > 0) {
        const userThreads = await supabaseMessagingService.getUserThreads({
          id: currentUser.id,
          name: currentUser.name || '',
        })
        const threadMap = new Map<string, ChatThread>()
        userThreads.forEach(thread => {
          if (openThreads.includes(thread.id)) {
            threadMap.set(thread.id, thread)
          }
        })
        setThreads(threadMap)
      }
    }
    loadThreads()
  }, [currentUser, openThreads])

  const minimizeThread = (threadId: string) => {
    setMinimizedThreadIds(prev => {
      if (!prev.includes(threadId)) {
        return [...prev, threadId]
      }
      return prev
    })
  }

  const handleMinimize = (threadId: string) => {
    minimizeThread(threadId)
  }

  // Avoid rendering portal until mounted on client
  if (!mounted) return null

  if (!openThreads || openThreads.length === 0) return null

  const minimizedThreads = minimizedThreadIds.reduce<ChatThread[]>((acc: ChatThread[], threadId: string) => {
    const thread = threads.get(threadId)
    if (thread) {
      acc.push(thread)
    }
    return acc
  }, [])

  return ReactDOM.createPortal(
    <div className="fixed bottom-4 right-4 z-[200] sm:bottom-6 sm:right-6">
      <div className="flex max-w-full items-end justify-end gap-4">
        {openThreads
          .filter((threadId: string) => !minimizedThreadIds.includes(threadId))
          .map((threadId: string) => (
            <div key={threadId} className="pointer-events-auto">
              <ChatWindow threadId={threadId} onClose={closeThread} onMinimize={handleMinimize} />
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
              {minimizedThreads.map((thread: ChatThread) => {
                const handleOpen = () => {
                  setMinimizedThreadIds(prev => prev.filter(id => id !== thread.id))
                  openThread(thread.id)
                }
                return (
                  <div
                    key={thread.id}
                    onDoubleClick={handleOpen}
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
                          handleOpen()
                        }}
                        className="text-xs text-gray-400 hover:text-primary-600"
                      >
                        Open
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

export default ChatDock



