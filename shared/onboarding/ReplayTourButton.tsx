'use client'

import { HelpCircle } from '@/shared/icons'
import { useOnboardingOptional } from './OnboardingProvider'

export function ReplayTourButton({ className = '' }: { className?: string }) {
  const onboarding = useOnboardingOptional()
  if (!onboarding) return null

  return (
    <button
      type="button"
      onClick={() => onboarding.replayTour()}
      className={`group flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-content-secondary transition-colors duration-200 hover:bg-gray-50 hover:text-gray-700 dark:hover:bg-surface-hover dark:hover:text-content ${className}`}
      data-tour="replay-tour"
      aria-label="Replay guided tour for this screen"
    >
      <HelpCircle
        className="h-4 w-4 shrink-0 text-content-secondary group-hover:text-gray-600 dark:group-hover:text-content"
        strokeWidth={1.75}
      />
      <span className="min-w-0 flex-1 truncate">Replay Guided Tour</span>
    </button>
  )
}
