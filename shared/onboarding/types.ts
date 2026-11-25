export type OnboardingModule = 'gsch' | 'youth_leadership'

export type OnboardingStatus = 'not_started' | 'completed' | 'skipped'

export type OnboardingProgressRow = {
  id?: string
  user_id?: string
  module: OnboardingModule
  screen_key: string
  status: OnboardingStatus
  completed_at?: string | null
  created_at?: string
  updated_at?: string
}

export type OnboardingStep = {
  /** CSS selector; omit for a centered welcome popover */
  element?: string
  title: string
  description: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  /** Skip this step when the target is missing (permissions / conditional UI) */
  optional?: boolean
}

export type ScreenTourConfig = {
  module: OnboardingModule
  screenKey: string
  /** Match pathname prefixes for this screen */
  pathPrefixes: string[]
  /** Exact pathname match (useful for hub home) */
  exactPaths?: string[]
  steps: OnboardingStep[]
}

export type ProgressMap = Record<string, OnboardingStatus>
