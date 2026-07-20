'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PhoneOff, UserPlus, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { friendRequestService } from '@/features/social/services/friendRequestService'
import {
  FRIENDS_REQUIRED_FOR_CALL_EVENT,
  type FriendsRequiredForCallDetail,
  type FriendshipCallStatus,
} from '@/shared/utils/friendsRequiredCall'

function copyForStatus(
  status: FriendshipCallStatus,
  name: string
): { title: string; body: string; primaryLabel?: string } {
  switch (status) {
    case 'pending_sent':
      return {
        title: 'Friend request pending',
        body: `Your friend request to ${name} is still pending. You can call once they accept.`,
      }
    case 'pending_received':
      return {
        title: 'Accept friend request to call',
        body: `${name} sent you a friend request. Accept it to start voice or video calls.`,
        primaryLabel: 'Accept request',
      }
    case 'none':
    default:
      return {
        title: 'Friends only',
        body: `You can only call people you are friends with. Send ${name} a friend request to unlock calling.`,
        primaryLabel: 'Send friend request',
      }
  }
}

const FriendsRequiredCallDialog: React.FC = () => {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<FriendsRequiredForCallDetail | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onRequired = (event: Event) => {
      const custom = event as CustomEvent<FriendsRequiredForCallDetail>
      if (!custom.detail?.targetUserId) return
      setDetail(custom.detail)
      setOpen(true)
    }
    window.addEventListener(FRIENDS_REQUIRED_FOR_CALL_EVENT, onRequired)
    return () => {
      window.removeEventListener(FRIENDS_REQUIRED_FOR_CALL_EVENT, onRequired)
    }
  }, [])

  const close = useCallback((force = false) => {
    if (busy && !force) return
    setBusy(false)
    setOpen(false)
    setDetail(null)
  }, [busy])

  if (!open || !detail) return null

  const name = detail.targetUserName?.trim() || 'this user'
  const copy = copyForStatus(detail.status, name)

  const handlePrimary = async () => {
    if (busy) return
    setBusy(true)
    try {
      if (detail.status === 'none') {
        const result = await friendRequestService.sendFriendRequest(detail.targetUserId)
        if (!result.success) {
          toast.error(result.error || 'Failed to send friend request')
          return
        }
        toast.success(`Friend request sent to ${name}`)
        setDetail({ ...detail, status: 'pending_sent' })
        return
      }
      if (detail.status === 'pending_received' && detail.requestId) {
        const result = await friendRequestService.acceptFriendRequest(detail.requestId)
        if (!result.success) {
          toast.error(result.error || 'Failed to accept request')
          return
        }
        toast.success(`You and ${name} are now friends! You can call them now.`)
        close(true)
        return
      }
      router.push('/friends?tab=requests')
      close(true)
    } catch {
      toast.error('Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const showPrimary =
    detail.status === 'none' ||
    (detail.status === 'pending_received' && Boolean(detail.requestId))

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="friends-required-call-title"
      onClick={() => close()}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600">
              <PhoneOff className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="friends-required-call-title"
                className="text-lg font-semibold text-content"
              >
                {copy.title}
              </h2>
              <p className="mt-1 text-sm text-content-secondary">{copy.body}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => close()}
            disabled={busy}
            className="rounded-full p-1.5 text-content-tertiary transition hover:bg-surface-hover hover:text-content disabled:opacity-40"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-4">
          <button
            type="button"
            onClick={() => close()}
            disabled={busy}
            className="rounded-lg px-4 py-2 text-sm font-medium text-content-secondary transition hover:bg-surface-hover disabled:opacity-40"
          >
            Got it
          </button>
          {showPrimary && (
            <button
              type="button"
              onClick={() => void handlePrimary()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-40"
            >
              <UserPlus className="h-4 w-4" />
              {busy ? 'Please wait…' : copy.primaryLabel}
            </button>
          )}
          {detail.status === 'pending_sent' && (
            <button
              type="button"
              onClick={() => {
                router.push('/friends')
                close(true)
              }}
              disabled={busy}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-40"
            >
              View friends
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default FriendsRequiredCallDialog
