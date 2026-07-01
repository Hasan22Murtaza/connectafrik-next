'use client'

import React from 'react'
import { Loader2, Sparkles } from 'lucide-react'

export type CreateStep = 'media' | 'details' | 'review'

interface WizardHeaderActionsProps {
  currentStep: CreateStep
  canGoNext: boolean
  isPublishing: boolean
  publishLabel: string
  onNext: () => void
}

export function WizardHeaderActions({
  currentStep,
  canGoNext,
  isPublishing,
  publishLabel,
  onNext,
}: WizardHeaderActionsProps) {
  const isReviewStep = currentStep === 'review'
  const nextLabel = currentStep === 'details' ? 'Review' : 'Next'

  if (isReviewStep) {
    return (
      <button
        type="submit"
        form="create-memory-form"
        disabled={!canGoNext || isPublishing}
        className="btn-primary inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:gap-2 sm:px-4 sm:py-2"
        aria-busy={isPublishing}
      >
        {isPublishing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            <span className="hidden sm:inline">{publishLabel}</span>
            <span className="sm:hidden">…</span>
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" aria-hidden />
            <span>Publish</span>
          </>
        )}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onNext}
      disabled={!canGoNext || isPublishing}
      className="btn-primary shrink-0 rounded-xl px-3.5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:py-2"
    >
      {nextLabel}
    </button>
  )
}
