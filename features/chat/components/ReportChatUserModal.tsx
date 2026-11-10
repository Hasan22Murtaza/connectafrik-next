'use client'

import React, { useEffect, useId, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { ApiError } from '@/lib/api-client'
import {
  POST_REPORT_REASON_OPTIONS,
  type ChatReportedMessageSnapshot,
  type PostReportReason,
} from '@/lib/reports/types'
import { submitChatUserReport } from '@/features/chat/services/chatReportService'
import { ChevronRight } from '@/shared/icons'

interface ReportChatUserModalProps {
  threadId: string
  reportedUserId: string
  userName: string
  messageSnapshot?: ChatReportedMessageSnapshot[]
  isOpen: boolean
  onClose: () => void
  onSubmitted?: (reason: PostReportReason) => void
}

export function ReportChatUserModal({
  threadId,
  reportedUserId,
  userName,
  messageSnapshot,
  isOpen,
  onClose,
  onSubmitted,
}: ReportChatUserModalProps) {
  const titleId = useId()
  const notesId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const [notes, setNotes] = useState('')
  const [submittingReason, setSubmittingReason] = useState<PostReportReason | null>(
    null
  )

  useEffect(() => {
    if (!isOpen) return
    setNotes('')
    setSubmittingReason(null)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const frame = window.requestAnimationFrame(() => {
      dialogRef.current?.focus()
    })
    return () => {
      window.cancelAnimationFrame(frame)
      document.body.style.overflow = prev
    }
  }, [isOpen, threadId, reportedUserId])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submittingReason) {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, submittingReason, onClose])

  if (!isOpen) return null

  const handleSubmit = async (reason: PostReportReason) => {
    if (submittingReason) return
    setSubmittingReason(reason)
    try {
      await submitChatUserReport({
        threadId,
        reportedUserId,
        reason,
        notes: notes.trim() || undefined,
        messageSnapshot,
      })
      toast.success("Thanks for reporting. We'll review this chat.")
      onSubmitted?.(reason)
      onClose()
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Could not submit report'
      toast.error(message)
    } finally {
      setSubmittingReason(null)
    }
  }

  const busy = Boolean(submittingReason)

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={(e) => {
        e.stopPropagation()
        if (!busy && e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="flex max-h-[min(92dvh,40rem)] w-full max-w-[28rem] flex-col overflow-hidden rounded-t-2xl bg-surface shadow-xl outline-none sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-5 pb-4 pt-5">
          <h2 id={titleId} className="text-lg font-semibold text-content">
            Report {userName}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-content-secondary">
            The last 5 messages in this chat are included so our team can review
            them. They won&apos;t be told you reported them.
          </p>
          <label htmlFor={notesId} className="sr-only">
            Anything else we should know? (optional)
          </label>
          <textarea
            id={notesId}
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, 2000))}
            disabled={busy}
            rows={3}
            placeholder="Anything else we should know? (optional)"
            className="mt-4 w-full resize-none rounded-xl border border-border bg-surface-secondary px-3 py-2.5 text-[15px] text-content placeholder:text-content-tertiary outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 disabled:opacity-60"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {POST_REPORT_REASON_OPTIONS.map((option) => {
            const isThisSubmitting = submittingReason === option.value
            return (
              <button
                key={option.value}
                type="button"
                disabled={busy}
                onClick={() => void handleSubmit(option.value)}
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left text-[15px] text-content transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="min-w-0 flex-1">{option.label}</span>
                {isThisSubmitting ? (
                  <span className="text-xs text-content-tertiary">Sending…</span>
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-content-tertiary" />
                )}
              </button>
            )
          })}
        </div>

        <div className="border-t border-border px-5 py-3 sm:hidden">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="w-full rounded-xl py-2.5 text-[15px] font-semibold text-content transition-opacity hover:opacity-70 disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
