import { errorResponse } from '@/lib/api-utils'
import { PARENTAL_RESTRICTED_CODE } from '@/shared/types/family'
import type { ParentalDecision } from './controls'
import { FamilyAuthError } from './auth'

export function parentalRestrictedResponse(decision: ParentalDecision) {
  return errorResponse(decision.message || 'Restricted by parental controls', 403, {
    code: PARENTAL_RESTRICTED_CODE,
  })
}

export function parentalDecisionResponse(decision: ParentalDecision) {
  if (decision.allowed) return null
  return parentalRestrictedResponse(decision)
}

export function familyAuthErrorResponse(error: unknown) {
  if (error instanceof FamilyAuthError) {
    return errorResponse(error.message, error.status)
  }
  return null
}
