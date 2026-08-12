'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  ImagePlus,
  MessageSquare,
  Send,
  X,
} from '@/shared/icons'
import toast from 'react-hot-toast'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/shared/hooks/useProfile'
import {
  FEEDBACK_TYPE_OPTIONS,
  submitFeedback,
} from '@/features/feedback/services/feedbackService'
import type { FeedbackType } from '@/lib/feedback/types'

const MAX_FILE_BYTES = 5 * 1024 * 1024

export default function FeedbackPage() {
  const { user } = useAuth()
  const { profile } = useProfile()

  const defaultName = useMemo(
    () => profile?.full_name || profile?.username || '',
    [profile?.full_name, profile?.username]
  )
  const defaultEmail = useMemo(() => user?.email || '', [user?.email])

  const [feedbackType, setFeedbackType] = useState<FeedbackType | ''>('')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [userName, setUserName] = useState('')
  const [attachment, setAttachment] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (defaultName) setUserName(defaultName)
  }, [defaultName])

  useEffect(() => {
    if (defaultEmail) setEmail(defaultEmail)
  }, [defaultEmail])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const validate = () => {
    const next: Record<string, string> = {}
    if (!feedbackType) next.feedbackType = 'Please select a feedback type'
    if (title.trim().length < 3) next.title = 'Title must be at least 3 characters'
    if (message.trim().length < 10) next.message = 'Please share a bit more detail (10+ characters)'
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = 'Enter a valid email address'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleFileChange = (file: File | null) => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }

    if (!file) {
      setAttachment(null)
      return
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error('Image must be 5MB or smaller')
      return
    }

    setAttachment(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    try {
      await submitFeedback({
        feedback_type: feedbackType as FeedbackType,
        title: title.trim(),
        message: message.trim(),
        email: email.trim() || undefined,
        user_name: userName.trim() || undefined,
        attachment,
      })
      setSubmitted(true)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit feedback')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-orange-50/80 via-white to-slate-50 py-10 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 sm:py-16">
        <div className="mx-auto max-w-xl px-4 sm:px-6">
          <div className="rounded-2xl border border-orange-100 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-10">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              Feedback received
            </h1>
            <p className="mt-3 text-[15px] leading-7 text-slate-600 dark:text-slate-300">
              Thank you for your feedback! We appreciate your input and will use it to improve our
              platform.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary-700"
              >
                Back to home
              </Link>
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false)
                  setFeedbackType('')
                  setTitle('')
                  setMessage('')
                  setAttachment(null)
                  if (previewUrl) URL.revokeObjectURL(previewUrl)
                  setPreviewUrl(null)
                  setErrors({})
                }}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Submit another
              </button>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-orange-50/80 via-white to-slate-50 py-8 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 sm:py-12">
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        <header className="mb-8 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/40 dark:text-orange-300">
            <MessageSquare className="h-3.5 w-3.5" />
            Feedback
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-4xl">
            Help us improve ConnectAfrik
          </h1>
          <p className="max-w-xl text-[15px] leading-7 text-slate-600 dark:text-slate-300">
            Share a feature idea, report a bug, or tell us what we can do better. Your feedback goes
            directly to our team — it is not shown publicly.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-8"
        >
          <div>
            <label
              htmlFor="feedback-type"
              className="mb-1.5 block text-sm font-medium text-slate-800 dark:text-slate-200"
            >
              Feedback type <span className="text-orange-600">*</span>
            </label>
            <select
              id="feedback-type"
              value={feedbackType}
              onChange={(e) => setFeedbackType(e.target.value as FeedbackType | '')}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-primary-300 focus:bg-white focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="">Select a type</option>
              {FEEDBACK_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.feedbackType && (
              <p className="mt-1.5 text-xs text-red-600">{errors.feedbackType}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="feedback-title"
              className="mb-1.5 block text-sm font-medium text-slate-800 dark:text-slate-200"
            >
              Title <span className="text-orange-600">*</span>
            </label>
            <input
              id="feedback-title"
              type="text"
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short summary of your feedback"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary-300 focus:bg-white focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            {errors.title && <p className="mt-1.5 text-xs text-red-600">{errors.title}</p>}
          </div>

          <div>
            <label
              htmlFor="feedback-message"
              className="mb-1.5 block text-sm font-medium text-slate-800 dark:text-slate-200"
            >
              Detailed feedback <span className="text-orange-600">*</span>
            </label>
            <textarea
              id="feedback-message"
              value={message}
              maxLength={5000}
              rows={6}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us what happened, what you expected, or what you'd like to see..."
              className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary-300 focus:bg-white focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <div className="mt-1.5 flex items-center justify-between">
              {errors.message ? (
                <p className="text-xs text-red-600">{errors.message}</p>
              ) : (
                <span />
              )}
              <p className="text-xs text-slate-400">{message.length}/5000</p>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-800 dark:text-slate-200">
              Screenshot or image <span className="font-normal text-slate-400">(optional)</span>
            </label>
            {!attachment ? (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-8 text-center transition hover:border-orange-300 hover:bg-orange-50/40 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-orange-700">
                <ImagePlus className="h-6 w-6 text-slate-400" />
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  Click to upload an image
                </span>
                <span className="text-xs text-slate-400">JPG, PNG, WEBP, or GIF · max 5MB</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                />
              </label>
            ) : (
              <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                {previewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="Attachment preview"
                    className="max-h-56 w-full object-contain bg-slate-50 dark:bg-slate-900"
                  />
                )}
                <button
                  type="button"
                  onClick={() => handleFileChange(null)}
                  className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-sm transition hover:bg-white"
                  aria-label="Remove attachment"
                >
                  <X className="h-4 w-4" />
                </button>
                <p className="truncate border-t border-slate-100 px-3 py-2 text-xs text-slate-500 dark:border-slate-800">
                  {attachment.name}
                </p>
              </div>
            )}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="feedback-name"
                className="mb-1.5 block text-sm font-medium text-slate-800 dark:text-slate-200"
              >
                Your name{' '}
                {user ? (
                  <span className="font-normal text-slate-400">(from your account)</span>
                ) : (
                  <span className="font-normal text-slate-400">(optional)</span>
                )}
              </label>
              <input
                id="feedback-name"
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                readOnly={Boolean(user && defaultName)}
                placeholder="Your name"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary-300 focus:bg-white focus:ring-2 focus:ring-primary-500/20 read-only:cursor-default read-only:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:read-only:bg-slate-900/80"
              />
            </div>
            <div>
              <label
                htmlFor="feedback-email"
                className="mb-1.5 block text-sm font-medium text-slate-800 dark:text-slate-200"
              >
                Email <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                id="feedback-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary-300 focus:bg-white focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              {errors.email && <p className="mt-1.5 text-xs text-red-600">{errors.email}</p>}
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-primary-600/20 transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            <Send className="h-4 w-4" />
            {submitting ? 'Submitting…' : 'Submit feedback'}
          </button>
        </form>
      </div>
    </main>
  )
}
