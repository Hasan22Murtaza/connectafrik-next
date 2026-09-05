'use client'

import React, { useEffect, useId, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { ApiError } from '@/lib/api-client'
import { POST_REPORT_REASON_OPTIONS, type PostReportReason } from '@/lib/reports/types'
import { submitPostReport } from '@/features/social/services/reportService'

interface ReportPostModalProps {
  postId: string
  isOpen: boolean
  onClose: () => void
  onSubmitted?: (postId: string, reason: PostReportReason) => void
}

export function ReportPostModal({
  postId,
  isOpen,
  onClose,
  onSubmitted,
}: ReportPostModalProps) {
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
  }, [isOpen, postId])

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
      await submitPostReport(postId, reason)
      toast.success("Thanks for reporting. We'll review this post.")
      onSubmitted?.(postId, reason)
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
      onClick={(e) => {
        e.stopPropagation()
        if (!submitting && e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-[28rem] rounded-2xl bg-white p-6 shadow-xl outline-none sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-lg font-semibold text-gray-900 sm:text-xl">
          Report image or title
        </h2>

        <fieldset className="mt-5 m-0 border-0 p-0" disabled={submitting}>
          <legend className="sr-only">Report reason</legend>
          <div role="radiogroup" aria-labelledby={titleId} className="space-y-1">
            {POST_REPORT_REASON_OPTIONS.map((option) => {
              const inputId = `${groupName}-${option.value}`
              return (
                <label
                  key={option.value}
                  htmlFor={inputId}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-1 py-2.5 hover:bg-gray-50"
                >
                  <input
                    id={inputId}
                    type="radio"
                    name={groupName}
                    value={option.value}
                    checked={reason === option.value}
                    onChange={() => setReason(option.value)}
                    className="h-4 w-4 shrink-0 cursor-pointer accent-gray-900"
                  />
                  <span className="text-[15px] text-gray-900">{option.label}</span>
                </label>
              )
            })}
          </div>
        </fieldset>

        <div className="mt-6 flex items-center justify-end gap-6">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-[15px] font-semibold text-gray-900 transition-opacity hover:opacity-70 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!reason || submitting}
            className={`text-[15px] font-semibold transition-colors ${
              !reason || submitting
                ? 'cursor-not-allowed text-gray-300'
                : 'text-gray-900 hover:opacity-70'
            }`}
          >
            {submitting ? 'Reporting…' : 'Report'}
          </button>
        </div>
      </div>
    </div>
  )
}
