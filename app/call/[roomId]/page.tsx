'use client'

import React, { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api-client'

const VideoSDKCallModal = dynamic(() => import('@/features/video/components/VideoSDKCallModal'), {
  ssr: false,
})

function notifyParentCallEnded(threadId: string, callId?: string) {
  if (typeof window !== 'undefined' && threadId && window.opener) {
    try {
      window.opener.postMessage(
        { type: 'CALL_STATUS', status: 'ended', threadId, ...(callId ? { callId } : {}) },
        window.location.origin
      )
    } catch {}
  }
}

type CallDisplay = {
  callerName: string
  recipientName: string
  callerAvatarUrl: string
  recipientAvatarUrl: string
}

function parseSessionMetadata(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }
  return {}
}

export default function CallWindowPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [callDisplay, setCallDisplay] = useState<CallDisplay | null>(null)

  const roomId = params?.roomId as string
  const callParam = searchParams?.get('call') ?? 'true'
  const isOpen = callParam === 'true'
  const callType = (searchParams?.get('type') || 'video') as 'audio' | 'video'
  const threadId = searchParams?.get('threadId') || ''
  const isGroupCallHint = searchParams?.get('isGroupCall') === 'true'
  const isIncoming = searchParams?.get('isIncoming') === 'true'
  const callId = searchParams?.get('callId') || ''

  const currentUserName = useMemo(() => {
    if (!user) return 'You'
    return (
      user.user_metadata?.full_name ||
      [user.user_metadata?.first_name, user.user_metadata?.last_name].filter(Boolean).join(' ') ||
      user.email ||
      'You'
    )
  }, [user])

  const localAvatarFromAuth = useMemo(() => {
    if (!user) return ''
    const md = user.user_metadata || {}
    return (
      (typeof md.avatar_url === 'string' && md.avatar_url) ||
      (typeof md.picture === 'string' && md.picture) ||
      ''
    )
      .trim()
  }, [user])

  useEffect(() => {
    if (!threadId || !user?.id || authLoading) return
    let cancelled = false

    const localName = currentUserName
    const localAvatar = localAvatarFromAuth

    if (!callId.trim()) {
      setCallDisplay({
        callerName: isIncoming ? 'Unknown' : localName,
        recipientName: isIncoming ? localName : 'Unknown',
        callerAvatarUrl: isIncoming ? '' : localAvatar,
        recipientAvatarUrl: isIncoming ? localAvatar : '',
      })
      return
    }

    ;(async () => {
      try {
        const { session: row } = await apiClient.get<{ session: Record<string, unknown> | null }>(
          `/api/chat/threads/${threadId}/call-sessions`,
          { call_id: callId }
        )
        if (cancelled) return

        const meta = parseSessionMetadata(row?.metadata)
        const callerNameMeta = typeof meta.callerName === 'string' ? meta.callerName : ''
        let callerAvatarMeta = typeof meta.callerAvatarUrl === 'string' ? meta.callerAvatarUrl : ''
        const targetUserId = typeof meta.targetUserId === 'string' ? meta.targetUserId.trim() : ''
        const isGroupFromMeta = meta.isGroupCall === true

        type ThreadData = {
          name?: string | null
          title?: string | null
          chat_participants?: Array<{
            user?: {
              id?: string
              full_name?: string | null
              username?: string | null
              avatar_url?: string | null
            }
          }>
        }

        const loadThread = () =>
          apiClient.get<{ data: ThreadData; meta?: unknown }>(`/api/chat/threads/${threadId}`)

        if (isIncoming) {
          const createdBy = typeof row?.created_by === 'string' ? row.created_by : ''
          let recipientAv = localAvatar
          callerAvatarMeta = (callerAvatarMeta || '').trim()
          const needsThread =
            (!callerAvatarMeta && !!createdBy) || (!recipientAv.trim() && !!user.id)

          if (needsThread) {
            const threadBundle = await loadThread()
            if (cancelled) return
            const participants = threadBundle.data?.chat_participants || []
            const users = participants.map((p) => p?.user).filter(Boolean) as NonNullable<
              (typeof participants)[0]['user']
            >[]

            if (!callerAvatarMeta && createdBy) {
              callerAvatarMeta = (users.find((u) => u.id === createdBy)?.avatar_url || '').trim()
            }
            if (!recipientAv.trim() && user.id) {
              recipientAv = (users.find((u) => u.id === user.id)?.avatar_url || '').trim()
            }
          }

          setCallDisplay({
            callerName: callerNameMeta || 'Unknown',
            recipientName: localName,
            callerAvatarUrl: callerAvatarMeta,
            recipientAvatarUrl: recipientAv,
          })
          return
        }

        const group = isGroupCallHint || isGroupFromMeta

        const threadBundle = await loadThread()
        if (cancelled) return

        const t = threadBundle.data

        const participants = t?.chat_participants || []
        const users = participants.map((p) => p?.user).filter(Boolean) as NonNullable<
          (typeof participants)[0]['user']
        >[]
        const selfUser = users.find((u) => u.id === user.id)
        const localAvatarResolved = (
          localAvatar ||
          (selfUser?.avatar_url || '').trim() ||
          ''
        ).trim()

        if (group) {
          const groupLabel = (t?.name || t?.title || 'Group Call').toString()
          setCallDisplay({
            callerName: localName,
            recipientName: groupLabel,
            callerAvatarUrl: localAvatarResolved,
            recipientAvatarUrl: '',
          })
          return
        }

        let other = users.find((u) => u.id && u.id === targetUserId && u.id !== user.id)
        if (!other) {
          other = users.find((u) => u.id && u.id !== user.id)
        }

        const rName = other?.full_name || other?.username || 'Unknown'
        const rAvatar = (other?.avatar_url || '').trim()

        setCallDisplay({
          callerName: localName,
          recipientName: rName,
          callerAvatarUrl: localAvatarResolved,
          recipientAvatarUrl: rAvatar,
        })
      } catch {
        if (!cancelled) {
          setCallDisplay({
            callerName: isIncoming ? 'Unknown' : localName,
            recipientName: isIncoming ? localName : 'Unknown',
            callerAvatarUrl: isIncoming ? '' : localAvatar,
            recipientAvatarUrl: isIncoming ? localAvatar : '',
          })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    threadId,
    callId,
    user?.id,
    authLoading,
    isIncoming,
    isGroupCallHint,
    currentUserName,
    localAvatarFromAuth,
  ])

  const handleCallEnd = () => {
    notifyParentCallEnded(threadId, callId || undefined)
    const newParams = new URLSearchParams(searchParams?.toString() || '')
    newParams.set('call', 'false')
    router.replace(`/call/${roomId}?${newParams.toString()}`)
    setTimeout(() => {
      if (typeof window !== 'undefined') window.close()
    }, 1500)
  }

  useEffect(() => {
    const onBeforeUnload = () => notifyParentCallEnded(threadId, callId || undefined)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [threadId, callId])

  const showCallUi = callDisplay !== null && !authLoading && user?.id

  return (
    <div className="w-full h-screen bg-black overflow-hidden">
      {isOpen ? (
        showCallUi ? (
          <VideoSDKCallModal
            isOpen={true}
            onClose={handleCallEnd}
            callType={callType}
            callerName={callDisplay.callerName}
            recipientName={callDisplay.recipientName}
            callerAvatarUrl={callDisplay.callerAvatarUrl}
            recipientAvatarUrl={callDisplay.recipientAvatarUrl}
            isGroupCallHint={isGroupCallHint}
            isIncoming={isIncoming}
            onAccept={() => {}}
            onReject={handleCallEnd}
            onCallEnd={handleCallEnd}
            threadId={threadId}
            currentUserId={user?.id}
            roomIdHint={roomId}
            callIdHint={callId}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-white gap-3 px-4 text-center">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <p className="text-sm text-white/80">
              {!user?.id && !authLoading ? 'Sign in to join this call.' : 'Loading call…'}
            </p>
          </div>
        )
      ) : (
        <div className="flex items-center justify-center h-full text-white text-sm sm:text-base md:text-lg px-4 text-center">
          Call ended
        </div>
      )}
    </div>
  )
}
