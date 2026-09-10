'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Capacitor } from '@capacitor/core'
import { useAuth } from '@/contexts/AuthContext'
import { setApiClientExtraHeaders } from '@/lib/api-client'
import { supabaseMessagingService, type ChatThread } from '@/features/chat/services/supabaseMessagingService'
import { ChatLockAuthModal, type ChatLockAuthMode } from '@/features/chat/components/ChatLockAuthModal'
import { CHAT_THREAD_MARKED_READ_EVENT } from '@/features/chat/threadReadEvents'
import {
  CHAT_LOCK_BACKGROUND_MS,
  CHAT_LOCK_CHANGED_EVENT,
  CHAT_LOCK_SESSION_ENDED_EVENT,
  CHAT_LOCK_STATUS_CHANGED_EVENT,
  CHAT_LOCK_TOKEN_HEADER,
} from '@/features/chat/chatLockEvents'

type AuthTarget = { threadId: string; title?: string }

type ChatLockContextValue = {
  lockedCount: number
  lockedUnread: number
  hasPin: boolean
  folderOpen: boolean
  unlockedThreadKey: string
  isThreadUnlocked: (threadId: string) => boolean
  refreshStatus: () => Promise<void>
  openLockedFolder: () => void
  closeLockedFolder: () => void
  unlockChat: (threadId: string, title?: string) => Promise<boolean>
  changePin: (threadId: string, title?: string) => Promise<boolean>
  lockThread: (threadId: string, title?: string) => Promise<ChatThread | null>
  unlockThread: (threadId: string, title?: string) => Promise<ChatThread | null>
}

const ChatLockContext = createContext<ChatLockContextValue | undefined>(undefined)

export function useChatLock() {
  const ctx = useContext(ChatLockContext)
  if (!ctx) {
    throw new Error('useChatLock must be used within ChatLockProvider')
  }
  return ctx
}

function dispatchThreadLockChanged(thread: ChatThread) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(CHAT_LOCK_CHANGED_EVENT, { detail: { thread } }))
  window.dispatchEvent(new CustomEvent(CHAT_LOCK_STATUS_CHANGED_EVENT))
}

export function ChatLockProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const tokenRef = useRef<string | null>(null)
  const [unlockToken, setUnlockToken] = useState<string | null>(null)
  const [folderOpen, setFolderOpen] = useState(false)
  const [lockedCount, setLockedCount] = useState(0)
  const [lockedUnread, setLockedUnread] = useState(0)
  const [hasPin, setHasPin] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<ChatLockAuthMode>('verify')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authSubmitting, setAuthSubmitting] = useState(false)
  const [authTitle, setAuthTitle] = useState<string | undefined>()
  const authResolverRef = useRef<((ok: boolean) => void) | null>(null)
  const authTargetRef = useRef<AuthTarget | null>(null)
  const lockResultRef = useRef<ChatThread | null>(null)
  const hiddenSinceRef = useRef<number | null>(null)

  const clearUnlockSession = useCallback((keepFolder = false) => {
    tokenRef.current = null
    setUnlockToken(null)
    if (!keepFolder) setFolderOpen(false)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(CHAT_LOCK_SESSION_ENDED_EVENT))
    }
  }, [])

  const rememberToken = useCallback((token: string) => {
    tokenRef.current = token
    setUnlockToken(token)
  }, [])

  const refreshStatus = useCallback(async () => {
    if (!user) {
      setLockedCount(0)
      setLockedUnread(0)
      setHasPin(false)
      return
    }
    try {
      const status = await supabaseMessagingService.getChatLockStatus()
      setLockedCount(status.locked_count)
      setLockedUnread(status.locked_unread)
      setHasPin(status.has_pin)
    } catch {
      /* keep last known */
    }
  }, [user])

  useEffect(() => {
    tokenRef.current = unlockToken
    setApiClientExtraHeaders((endpoint) => {
      const headers: Record<string, string> = {}
      if (tokenRef.current && endpoint?.startsWith('/api/chat/')) {
        headers[CHAT_LOCK_TOKEN_HEADER] = tokenRef.current
      }
      return headers
    })
    return () => setApiClientExtraHeaders(() => ({}))
  }, [unlockToken])

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  useEffect(() => {
    if (!user) return
    const unsubscribe = supabaseMessagingService.subscribeToUserThreads(
      { id: user.id, name: '' },
      () => {
        void refreshStatus()
      }
    )
    return unsubscribe
  }, [user, refreshStatus])

  useEffect(() => {
    if (!user) {
      clearUnlockSession()
      setLockedCount(0)
      setLockedUnread(0)
      setHasPin(false)
    }
  }, [user, clearUnlockSession])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onStatus = () => {
      void refreshStatus()
    }
    window.addEventListener(CHAT_LOCK_STATUS_CHANGED_EVENT, onStatus)
    window.addEventListener(CHAT_THREAD_MARKED_READ_EVENT, onStatus)
    return () => {
      window.removeEventListener(CHAT_LOCK_STATUS_CHANGED_EVENT, onStatus)
      window.removeEventListener(CHAT_THREAD_MARKED_READ_EVENT, onStatus)
    }
  }, [refreshStatus])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const expireIfBackgrounded = () => {
      if (document.visibilityState === 'hidden') {
        hiddenSinceRef.current = Date.now()
        return
      }
      const started = hiddenSinceRef.current
      hiddenSinceRef.current = null
      if (started && Date.now() - started >= CHAT_LOCK_BACKGROUND_MS) {
        clearUnlockSession()
      }
    }
    document.addEventListener('visibilitychange', expireIfBackgrounded)
    window.addEventListener('pagehide', () => {
      hiddenSinceRef.current = Date.now()
    })
    return () => {
      document.removeEventListener('visibilitychange', expireIfBackgrounded)
    }
  }, [clearUnlockSession])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let handle: { remove: () => Promise<void> } | undefined
    let resumeHandle: { remove: () => Promise<void> } | undefined
    void import('@capacitor/app').then(({ App }) => {
      void App.addListener('pause', () => {
        hiddenSinceRef.current = Date.now()
      }).then((h) => {
        handle = h
      })
      void App.addListener('resume', () => {
        const started = hiddenSinceRef.current
        hiddenSinceRef.current = null
        if (started && Date.now() - started >= CHAT_LOCK_BACKGROUND_MS) {
          clearUnlockSession()
        }
      }).then((h) => {
        resumeHandle = h
      })
    })
    return () => {
      void handle?.remove()
      void resumeHandle?.remove()
    }
  }, [clearUnlockSession])

  const closeAuth = useCallback((ok: boolean) => {
    authResolverRef.current?.(ok)
    authResolverRef.current = null
    setAuthOpen(false)
    setAuthError(null)
    setAuthSubmitting(false)
    if (!ok) {
      authTargetRef.current = null
      lockResultRef.current = null
    }
  }, [])

  const requestAuth = useCallback((mode: ChatLockAuthMode, target: AuthTarget) => {
    authResolverRef.current?.(false)
    authTargetRef.current = target
    setAuthTitle(target.title)
    setAuthMode(mode)
    setAuthError(null)
    setAuthOpen(true)
    return new Promise<boolean>((resolve) => {
      authResolverRef.current = resolve
    })
  }, [])

  const isThreadUnlocked = useCallback(
    (threadId: string) => Boolean(threadId && unlockToken),
    [unlockToken]
  )

  const openLockedFolder = useCallback(() => {
    setFolderOpen(true)
  }, [])

  const closeLockedFolder = useCallback(() => {
    setFolderOpen(false)
    clearUnlockSession(true)
  }, [clearUnlockSession])

  const unlockChat = useCallback(
    async (threadId: string, title?: string) => {
      if (!threadId) return false
      if (tokenRef.current) return true
      return requestAuth('verify', { threadId, title })
    },
    [requestAuth]
  )

  const changePin = useCallback(
    async (threadId: string, title?: string) => {
      if (!threadId) return false
      return requestAuth('change-pin', { threadId, title })
    },
    [requestAuth]
  )

  const lockThread = useCallback(
    async (threadId: string, title?: string) => {
      if (!user || !threadId) return null
      if (!hasPin) {
        lockResultRef.current = null
        const ok = await requestAuth('set-pin', { threadId, title })
        return ok ? lockResultRef.current : null
      }
      const updated = await supabaseMessagingService.setThreadLocked(threadId, user.id, true)
      if (updated) {
        dispatchThreadLockChanged(updated)
        void refreshStatus()
      }
      return updated
    },
    [hasPin, refreshStatus, requestAuth, user]
  )

  const unlockThread = useCallback(
    async (threadId: string, title?: string) => {
      if (!user || !threadId) return null
      if (!tokenRef.current) {
        const ok = await requestAuth('verify', { threadId, title })
        if (!ok) return null
      }
      const updated = await supabaseMessagingService.setThreadLocked(threadId, user.id, false)
      if (updated) {
        dispatchThreadLockChanged(updated)
        void refreshStatus()
      }
      return updated
    },
    [refreshStatus, requestAuth, user]
  )

  const handlePinSubmit = useCallback(
    async (pin: string, extras?: { current_pin?: string; password?: string }) => {
      const target = authTargetRef.current
      if (!target?.threadId) {
        setAuthError('Missing chat')
        return
      }
      setAuthSubmitting(true)
      setAuthError(null)
      try {
        if (authMode === 'set-pin') {
          if (!user) throw new Error('You must be signed in')
          const updated = await supabaseMessagingService.setThreadLocked(target.threadId, user.id, true, {
            pin,
          })
          if (!updated) throw new Error('Could not lock this chat')
          lockResultRef.current = updated
          const issued = await supabaseMessagingService.verifyChatLock({ pin })
          rememberToken(issued.token)
          dispatchThreadLockChanged(updated)
          setHasPin(true)
          void refreshStatus()
          closeAuth(true)
          return
        }
        if (authMode === 'change-pin') {
          await supabaseMessagingService.setChatLockPin(pin, extras)
          closeAuth(true)
          return
        }
        const issued = await supabaseMessagingService.verifyChatLock({ thread_id: target.threadId, pin })
        rememberToken(issued.token)
        closeAuth(true)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Could not authenticate'
        setAuthError(message)
        setAuthSubmitting(false)
      }
    },
    [authMode, closeAuth, refreshStatus, rememberToken, user]
  )

  const handlePasswordSubmit = useCallback(
    async (password: string) => {
      const target = authTargetRef.current
      setAuthSubmitting(true)
      setAuthError(null)
      try {
        const issued = await supabaseMessagingService.verifyChatLock({
          thread_id: target?.threadId,
          password,
        })
        rememberToken(issued.token)
        closeAuth(true)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Could not authenticate'
        setAuthError(message)
        setAuthSubmitting(false)
      }
    },
    [closeAuth, rememberToken]
  )

  const unlockedThreadKey = unlockToken ? 'unlocked' : ''

  const value = useMemo<ChatLockContextValue>(
    () => ({
      lockedCount,
      lockedUnread,
      hasPin,
      folderOpen,
      unlockedThreadKey,
      isThreadUnlocked,
      refreshStatus,
      openLockedFolder,
      closeLockedFolder,
      unlockChat,
      changePin,
      lockThread,
      unlockThread,
    }),
    [
      changePin,
      closeLockedFolder,
      folderOpen,
      hasPin,
      isThreadUnlocked,
      lockThread,
      lockedCount,
      lockedUnread,
      openLockedFolder,
      refreshStatus,
      unlockChat,
      unlockThread,
      unlockedThreadKey,
    ]
  )

  return (
    <ChatLockContext.Provider value={value}>
      {children}
      <ChatLockAuthModal
        open={authOpen}
        mode={authMode}
        chatTitle={authTitle}
        submitting={authSubmitting}
        error={authError}
        onSubmitPin={(pin, extras) => void handlePinSubmit(pin, extras)}
        onSubmitPassword={authMode === 'verify' ? (password) => void handlePasswordSubmit(password) : undefined}
        onCancel={() => closeAuth(false)}
      />
    </ChatLockContext.Provider>
  )
}
