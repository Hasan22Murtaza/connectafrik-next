'use client'

import React, { useEffect, useId, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { ApiError } from '@/lib/api-client'
import { POST_REPORT_REASON_OPTIONS, type PostReportReason } from '@/lib/reports/types'
import { apiClient } from '@/lib/api-client'

interface ReportReelModalProps {
  reelId: string
  isOpen: boolean
  onClose: () => void
  onSubmitted?: (reelId: string, reason: PostReportReason) => void
}

export function ReportReelModal({
  reelId,
  isOpen,
  onClose,
  onSubmitted,
}: ReportReelModalProps) {
  const titleId = useId()
  const groupName = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const [reason, setReason] = useState<PostReportReason | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setReason(null)
    setSubmitting(false)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const frame = window.requestAnimationFrame(() => {
      dialogRef.current?.focus()
    })
    return () => {
      window.cancelAnimationFrame(frame)
      document.body.style.overflow = prev
    }
  }, [isOpen, reelId])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, submitting, onClose])

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (!reason || submitting) return
    setSubmitting(true)
    try {
      await apiClient.post(`/api/reels/${reelId}/report`, { reason })
      toast.success("Thanks for reporting. We'll review this reel.")
      onSubmitted?.(reelId, reason)
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
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      role="presentation"
      onClick={() => {
        if (!submitting) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-xl outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-lg font-semibold text-content">
          Report reel
        </h2>
        <p className="mt-1 text-sm text-content-secondary">
          Select a reason. Reports are reviewed by the CribsTalk team.
        </p>

        <fieldset className="mt-4 space-y-2" name={groupName}>
          <legend className="sr-only">Report reason</legend>
          {POST_REPORT_REASON_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2.5 hover:bg-surface-hover"
            >
              <input
                type="radio"
                name={groupName}
                value={option.value}
                checked={reason === option.value}
                onChange={() => setReason(option.value)}
                className="text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-content">{option.label}</span>
            </label>
          ))}
        </fieldset>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg px-4 py-2 text-sm font-medium text-content hover:bg-surface-secondary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!reason || submitting}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit report'}
          </button>
        </div>
      </div>
    </div>
  )
}
