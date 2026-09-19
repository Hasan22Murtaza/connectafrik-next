import { errorResponse } from '@/lib/api-utils'
import { PRIVACY_DENIED_CODE } from '@/shared/utils/visibilityUtils'
import type { PrivacyDecision } from './types'

export function privacyDeniedResponse(message: string, status = 403) {
  return errorResponse(message, status, { code: PRIVACY_DENIED_CODE })
}

export function privacyDecisionResponse(decision: PrivacyDecision) {
  if (decision.allowed) return null
  return privacyDeniedResponse(decision.message || 'Not allowed', 403)
}
